# Inkwell — Phase 4: Data Model

**Spec-DD Phase:** 4 of 7 (Data Model)
**Status:** Draft for review
**Date:** 2026-08-13

Expands §27's conceptual entities into a concrete relational schema (PostgreSQL syntax, per the Phase 2 architecture proposal). JSONB is used for AI-output fields whose shape legitimately varies (adaptive summaries, note metadata) rather than forcing them into rigid columns, per §16's requirement that summaries not follow one fixed template.

---

## Entity-Relationship Overview

```
User 1──* Note *──1 Folder
User 1──* Folder (self-referencing parent_folder_id)
User 1──* Tag
Note *──* Tag        (via NoteTag, with confidence + source)
Note 1──* Document (a.k.a. Page)
Note 1──* HandwritingExample
User 1──1 HandwritingProfile
Note *──* Note        (via NoteRelationship, directional)
Note 1──* Embedding
User 1──* ProcessingJob  (via Note)
```

---

## Tables

### `users`
```sql
id                uuid primary key default gen_random_uuid()
email             text unique not null
password_hash     text                      -- null if OAuth-only
display_name      text
created_at        timestamptz not null default now()
settings          jsonb not null default '{}'
  -- settings shape: { retentionPolicy: 'permanent'|'30d'|'90d'|'1y'|'manual',
  --                    confidenceThresholdOverride: number|null,
  --                    theme: 'system'|'light'|'dark' }
deleted_at        timestamptz               -- soft-delete marker set on account deletion request,
                                             -- hard purge job removes row + all owned data after grace period
```

### `folders`
```sql
id                uuid primary key default gen_random_uuid()
user_id           uuid not null references users(id) on delete cascade
parent_folder_id  uuid references folders(id) on delete cascade
name              text not null
created_at        timestamptz not null default now()

-- constraint: no cycles (enforced at application layer on move/create)
-- index: (user_id, parent_folder_id)
```

### `tags`
```sql
id                uuid primary key default gen_random_uuid()
user_id           uuid not null references users(id) on delete cascade
name              text not null
normalized_name   text not null              -- lowercased/trimmed, used for AI dedup matching (FR-7.6)
created_at        timestamptz not null default now()

unique (user_id, normalized_name)
```

### `notes`
```sql
id                    uuid primary key default gen_random_uuid()
user_id               uuid not null references users(id) on delete cascade
folder_id             uuid references folders(id) on delete set null
title                 text
title_source          text not null default 'ai'      -- 'ai' | 'user'
note_type             text                              -- open-ended, AI-classified (§15); free text, not enum
note_type_confidence  real
transcription         text                              -- current authoritative (corrected) text, markdown-ish structure preserved
transcription_raw_ai  text                              -- last AI-generated transcription, kept for diffing/learning
summary               jsonb                              -- adaptive shape per note_type, see Phase 5 contracts
summary_source        text not null default 'ai'        -- 'ai' | 'user' | 'user_edited_ai'
metadata              jsonb not null default '{}'        -- entities, structural notes, misc AI output not worth own columns
processing_status     text not null default 'uploaded'   -- see Processing States below
processing_error      jsonb                               -- { stage, message, occurred_at } when status='error'
favorite              boolean not null default false
trashed_at            timestamptz                         -- soft delete; null = active
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()

-- index: (user_id, processing_status)
-- index: (user_id, folder_id)
-- index: (user_id, trashed_at)
-- full-text index: to_tsvector('english', title || ' ' || transcription || ' ' || summary::text)
```

**Processing states** (§29): `uploaded → preprocessing → transcribing → confidence_analysis → ready_for_review → reviewed → analyzing → ready`, with `error` reachable from any stage (error records which stage failed via `processing_error.stage`, and retry re-enters that stage).

### `documents` (a.k.a. "Page" in §27)
```sql
id                uuid primary key default gen_random_uuid()
note_id           uuid not null references notes(id) on delete cascade
page_number       int not null
storage_location  text                       -- object storage key; null once retention has removed the original
preprocessed_location text                   -- cleaned/deskewed version used for transcription, same retention lifecycle
image_metadata    jsonb not null default '{}' -- { width, height, contentHash, mimeType, originalFilename, capturedAt }
retention_status  text not null default 'active' -- 'active' | 'removed'
retention_expires_at timestamptz              -- computed from user's retention policy at upload time
created_at        timestamptz not null default now()

unique (note_id, page_number)
-- index: (image_metadata->>'contentHash')  -- duplicate-upload detection (FR-13.3)
```

### `tags` ↔ `notes`: `note_tags`
```sql
note_id           uuid not null references notes(id) on delete cascade
tag_id            uuid not null references tags(id) on delete cascade
confidence        real                       -- null for user-added tags
source            text not null              -- 'user' | 'ai'
created_at        timestamptz not null default now()

primary key (note_id, tag_id)
```

### `handwriting_examples`
```sql
id                uuid primary key default gen_random_uuid()
user_id           uuid not null references users(id) on delete cascade
note_id           uuid references notes(id) on delete set null
document_id       uuid references documents(id) on delete set null
source_region     jsonb                       -- { page: n, bbox: [x,y,w,h] } or coarser line/segment locator; nullable if unavailable
ai_text           text not null               -- AI's original interpretation of this span
corrected_text    text not null               -- user's corrected text for this span
classification    text not null               -- 'handwriting_correction' | 'content_edit' | 'rewrite' | 'formatting' | 'addition'
confidence         real                        -- AI's original confidence for this span
learning_weight    real not null               -- 0.0-1.0, see Phase 5 contract for evaluateHandwritingCorrection
created_at         timestamptz not null default now()

-- index: (user_id, classification, created_at)
```

### `handwriting_profiles`
```sql
id                    uuid primary key default gen_random_uuid()
user_id               uuid unique not null references users(id) on delete cascade
version               int not null default 1
vocabulary            jsonb not null default '[]'   -- [{ term, frequency, lastSeenAt, exampleIds[] }]
correction_patterns   jsonb not null default '[]'   -- [{ aiPattern, correctedPattern, occurrences, confidence, lastConfirmedAt }]
confidence_adjustments jsonb not null default '[]'  -- [{ pattern, adjustment, basis }]
updated_at            timestamptz not null default now()
```

One row per user; recomputed (not appended) by the `UPDATE_HANDWRITING_PROFILE` pipeline stage from the full `handwriting_examples` history, weighted toward recent/repeated examples (§12).

### `note_relationships`
```sql
id                uuid primary key default gen_random_uuid()
source_note_id    uuid not null references notes(id) on delete cascade
target_note_id    uuid not null references notes(id) on delete cascade
relationship_type text not null              -- 'same_topic'|'same_person'|'same_project'|'same_place'|
                                              -- 'similar_idea'|'continuation'|'contradiction'|
                                              -- 'supporting_information'|'reference'|'derived_idea' (open set)
confidence        real
basis             jsonb                       -- { sharedTags: [...], sharedEntities: [...], embeddingSimilarity: 0.87 } — explainability
created_at        timestamptz not null default now()

unique (source_note_id, target_note_id, relationship_type)
-- index: (target_note_id)  -- for reverse lookup when rendering "related notes" on either side
```

Relationships are stored directionally but rendered bidirectionally in the UI; storing both `basis` and `confidence` keeps this table queryable as a lightweight graph edge list, satisfying §19's "allows a graph-based system to be introduced later" without a rewrite.

### `embeddings`
```sql
id                uuid primary key default gen_random_uuid()
note_id           uuid not null references notes(id) on delete cascade
segment_type      text not null              -- 'full_note' | 'summary' | 'paragraph'
segment_index     int not null default 0     -- 0 for full_note/summary; paragraph ordinal otherwise
content_hash      text not null              -- to detect stale embeddings needing regeneration
vector            vector(1536)                -- pgvector column; dimension per chosen embedding model
created_at        timestamptz not null default now()

unique (note_id, segment_type, segment_index)
-- index: ivfflat/hnsw index on vector for ANN search
```

### `processing_jobs` (supports §28 async pipeline observability; not in original §27 list, added for architectural completeness)
```sql
id                uuid primary key default gen_random_uuid()
note_id           uuid not null references notes(id) on delete cascade
stage             text not null              -- one of the pipeline stages
status            text not null default 'queued' -- 'queued'|'running'|'succeeded'|'failed'
attempts          int not null default 0
last_error        text
started_at        timestamptz
finished_at       timestamptz
created_at        timestamptz not null default now()

-- index: (note_id, stage)
-- index: (status, created_at)  -- for worker polling
```

---

## Relationship & Cascade Notes

- Deleting a **note** cascades to its `documents`, `note_tags`, `handwriting_examples` (set null on note_id, examples are retained for learning value even if the source note is gone — per §12's "prioritize recent/repeated corrections," historical examples remain useful independent of the note's lifecycle), `embeddings`, and both directions of `note_relationships`.
- Deleting a **document** (original image only — FR-1.5) does **not** cascade to the note; it sets `storage_location`/`preprocessed_location` to null and `retention_status = 'removed'`, leaving `notes.transcription` untouched. This directly encodes §25's "deleting the original must NOT delete the transcription."
- Deleting a **folder** with notes in it requires the application layer to first reassign or null out `notes.folder_id` (UX: prompt user, per Phase 3 §8) — the FK uses `on delete set null` as a safety net, not as the primary UX path.
- Deleting a **tag** cascades only the `note_tags` join rows, not the notes themselves.
- User account deletion (§26/FR-1.6) cascades through every table above via `user_id`/`note_id` chains; a soft-delete (`users.deleted_at`) precedes hard purge to allow a short undo window, then a scheduled job performs the actual cascade delete plus object-storage cleanup.

## Indexing Strategy Summary

- Every user-scoped table is indexed on `(user_id, ...)` as its primary access pattern, since all queries are per-user (FR-16.1).
- `notes.transcription`/`summary`/`title` are covered by a combined `tsvector` GIN index for keyword search (§21 stage 1).
- `embeddings.vector` uses an ANN index (ivfflat or hnsw) for semantic search (§21 stage 2).
- `documents.image_metadata->>'contentHash'` is indexed for O(1) duplicate-upload detection (FR-13.3).
- `note_relationships` is indexed on both `source_note_id` and `target_note_id` since relationship lookups happen from either side (Note Detail's "related notes").

---

*Next: Phase 5 — AI Contracts (structured I/O for every AI operation).*
