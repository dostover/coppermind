import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { TranscriptSegment } from "./ai/types";
import { CONFIDENCE_THRESHOLD } from "./config";

// SQLite for this phase, schema narrowed from the Phase 4 data-model doc to
// what a single-page, single-user walking skeleton needs. Field names and
// shapes intentionally mirror the full `notes` / `handwriting_examples` /
// `handwriting_profiles` tables in docs/inkwell/04-data-model.md so that a
// later move to Postgres is a swap of this file, not a rewrite of callers -
// see claude/08-walking-skeleton-scope.md.

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "inkwell.sqlite"));
db.pragma("journal_mode = WAL");
// SQLite doesn't enforce foreign keys unless told to per-connection - without
// this, the `ON DELETE CASCADE` below on handwriting_examples is silently a
// no-op and deleting a note would leave its examples orphaned.
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    image_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | transcribing | ready_for_review | reviewed | error
    error_message TEXT,
    segments_ai TEXT NOT NULL,      -- JSON TranscriptSegment[], immutable AI output (transcription_raw_ai)
    segments_current TEXT NOT NULL, -- JSON TranscriptSegment[] with edited text (authoritative transcription)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Multi-page notes: a note is now a lightweight grouping row (title,
  -- aggregate status, folder/tags) and each page lives in note_pages, one
  -- row per uploaded image with its own transcription state - the "large/
  -- multi-page documents are processed page-by-page" design in
  -- 02-architecture.md §8. notes.image_path/segments_ai/segments_current
  -- above are now legacy columns, kept only so existing rows aren't broken;
  -- new code reads/writes exclusively through note_pages (see the one-time
  -- migration below) and notes.status becomes a derived aggregate
  -- (notesRepo.recomputeStatus) rather than something a page write sets
  -- directly.
  CREATE TABLE IF NOT EXISTS note_pages (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | transcribing | ready_for_review | error
    error_message TEXT,
    segments_ai TEXT NOT NULL DEFAULT '[]',
    segments_current TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (note_id, page_number)
  );

  CREATE INDEX IF NOT EXISTS idx_note_pages_note ON note_pages (note_id, page_number);

  CREATE TABLE IF NOT EXISTS handwriting_examples (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL,
    ai_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    classification TEXT NOT NULL,
    learning_weight REAL NOT NULL,
    original_confidence REAL,
    created_at TEXT NOT NULL
  );

  -- Singleton row: single implicit user for this phase (no auth yet).
  CREATE TABLE IF NOT EXISTS handwriting_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL DEFAULT 1,
    vocabulary TEXT NOT NULL DEFAULT '[]',            -- JSON [{ term, frequency }]
    correction_patterns TEXT NOT NULL DEFAULT '[]',   -- JSON [{ fromPattern, toPattern, occurrences, lastConfirmedAt }]
    updated_at TEXT NOT NULL
  );

  -- Folders/tags, narrowed from 04-data-model.md: flat (no parent_folder_id
  -- nesting) and manual-only for folders (no AI folder-suggestion flow) -
  -- tags do get an AI-suggestion pass (generateTags), folders don't, per the
  -- scoping decision for this feature. No user_id on any of these - still
  -- single implicit user.
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,  -- lowercased/trimmed, for AI/user dedup (FR-7.6)
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence REAL,          -- null for user-added tags
    source TEXT NOT NULL,     -- 'user' | 'ai'
    created_at TEXT NOT NULL,
    PRIMARY KEY (note_id, tag_id)
  );

  -- Narrowed from 04-data-model.md's processing_jobs: one stage ('transcribe',
  -- which also runs the tag-suggestion step - see jobs.ts) rather than the
  -- full multi-stage pipeline, since analyze/summarize/etc. aren't built yet.
  -- Durable so a server restart mid-job leaves a recoverable row instead of
  -- silently losing the work (the walking-skeleton's original synchronous
  -- upload had no such state at all - see claude/09-walking-skeleton-architecture.md's
  -- "Synchronous upload" note).
  CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'succeeded' | 'failed'
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL
  );

  -- Narrowed further, matches note_pages: a note's transcribe stage is now
  -- job-per-page so pages can be transcribed independently/in parallel-ready
  -- fashion, per 02-architecture.md §8 ("parallelizable"). This runner still
  -- only runs one job at a time (see jobs.ts), so "parallelizable" here means
  -- "not blocked on each other," not "literally concurrent" - a real worker
  -- pool would be the change to make that literal.

  -- index: (status, created_at) for the runner's poll query.
  CREATE INDEX IF NOT EXISTS idx_processing_jobs_poll ON processing_jobs (status, created_at);
`);

// notes.folder_id was added after the original table shape shipped - ALTER
// TABLE ADD COLUMN, guarded so it's a no-op (not an error) on a database
// that already has it. `ON DELETE SET NULL` isn't expressible on an added
// column via ALTER TABLE in SQLite, so that behavior (a deleted folder
// clears folder_id rather than deleting the note - 04-data-model.md's
// "safety net, not the primary UX path") is enforced in foldersRepo.delete
// below instead of at the schema level.
const noteColumns = db.prepare(`PRAGMA table_info(notes)`).all() as { name: string }[];
if (!noteColumns.some((c) => c.name === "folder_id")) {
  db.exec(`ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES folders(id)`);
}

// processing_jobs.page_id was added when the transcribe stage moved from
// note-scoped to page-scoped (multi-page notes). Nullable so historical rows
// from before this change (already terminal - succeeded/failed long ago)
// don't need backfilling; every new job enqueued from here on always sets it.
const jobColumns = db.prepare(`PRAGMA table_info(processing_jobs)`).all() as { name: string }[];
if (!jobColumns.some((c) => c.name === "page_id")) {
  db.exec(`ALTER TABLE processing_jobs ADD COLUMN page_id TEXT REFERENCES note_pages(id)`);
}

// One-time backfill: any note that predates note_pages (created when a note
// was still one row = one page) gets a single page-1 row built from its own
// legacy image_path/segments_ai/segments_current/status/error_message
// columns. Guarded by "no existing note_pages row for this note" so it's a
// no-op on every run after the first. 'reviewed' has no page-level
// equivalent (review is a note-level concept now), so it maps to
// 'ready_for_review' - the content is there and was already looked at,
// which is exactly what that page status means.
const legacyNotes = db
  .prepare(
    `SELECT id, image_path, status, error_message, segments_ai, segments_current, created_at, updated_at
     FROM notes
     WHERE image_path IS NOT NULL AND image_path != ''
       AND NOT EXISTS (SELECT 1 FROM note_pages WHERE note_pages.note_id = notes.id)`
  )
  .all() as {
  id: string;
  image_path: string;
  status: string;
  error_message: string | null;
  segments_ai: string;
  segments_current: string;
  created_at: string;
  updated_at: string;
}[];
if (legacyNotes.length > 0) {
  const insertLegacyPage = db.prepare(
    `INSERT INTO note_pages (id, note_id, page_number, image_path, status, error_message, segments_ai, segments_current, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const n of legacyNotes) {
      insertLegacyPage.run(
        randomUUID(),
        n.id,
        n.image_path,
        n.status === "reviewed" ? "ready_for_review" : n.status,
        n.error_message,
        n.segments_ai,
        n.segments_current,
        n.created_at,
        n.updated_at
      );
    }
  });
  tx();
  console.log(`Migrated ${legacyNotes.length} pre-multi-page note(s) into note_pages.`);
}

export interface NoteRow {
  id: string;
  title: string | null;
  status: "uploaded" | "transcribing" | "ready_for_review" | "reviewed" | "error";
  error_message: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteTagView {
  id: string;
  name: string;
  source: "user" | "ai";
  confidence: number | null;
}

export interface NotePageRow {
  id: string;
  note_id: string;
  page_number: number;
  image_path: string;
  status: "uploaded" | "transcribing" | "ready_for_review" | "error";
  error_message: string | null;
  segments_ai: string;
  segments_current: string;
  created_at: string;
  updated_at: string;
}

export interface NotePage extends Omit<NotePageRow, "segments_ai" | "segments_current"> {
  segmentsAi: TranscriptSegment[];
  segmentsCurrent: TranscriptSegment[];
}

// A note's own segmentsAi/segmentsCurrent are the concatenation of all its
// pages' segments, in page order - kept for callers (Library search/snippet,
// export) that just want "the whole note's text" and don't care that it may
// now span multiple images. `pages` is what the review UI actually renders.
export interface Note extends NoteRow {
  segmentsAi: TranscriptSegment[];
  segmentsCurrent: TranscriptSegment[];
  tags: NoteTagView[];
  pages: NotePage[];
}

// review-required is recomputed from each segment's stored raw confidence
// against the *current* CONFIDENCE_THRESHOLD every time a note is read,
// rather than trusting whatever was baked in at transcribe/retry time. This
// is what AC-5 actually requires: changing the threshold in config and
// re-rendering a previously-transcribed note must update its flags without
// re-transcribing. (A provider still sets an initial value on the way in;
// it's simply overwritten here.)
function applyReviewRequired(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map((s) => ({ ...s, reviewRequired: s.confidence < CONFIDENCE_THRESHOLD }));
}

function getTagsForNote(noteId: string): NoteTagView[] {
  return db
    .prepare(
      `SELECT tags.id as id, tags.name as name, note_tags.source as source, note_tags.confidence as confidence
       FROM note_tags JOIN tags ON tags.id = note_tags.tag_id
       WHERE note_tags.note_id = ?
       ORDER BY tags.name ASC`
    )
    .all(noteId) as NoteTagView[];
}

function rowToPage(row: NotePageRow): NotePage {
  return {
    ...row,
    segmentsAi: applyReviewRequired(JSON.parse(row.segments_ai)),
    segmentsCurrent: applyReviewRequired(JSON.parse(row.segments_current)),
  };
}

function getPagesForNote(noteId: string): NotePage[] {
  const rows = db
    .prepare(`SELECT * FROM note_pages WHERE note_id = ? ORDER BY page_number ASC`)
    .all(noteId) as NotePageRow[];
  return rows.map(rowToPage);
}

function rowToNote(row: NoteRow): Note {
  const pages = getPagesForNote(row.id);
  return {
    ...row,
    segmentsAi: pages.flatMap((p) => p.segmentsAi),
    segmentsCurrent: pages.flatMap((p) => p.segmentsCurrent),
    tags: getTagsForNote(row.id),
    pages,
  };
}

// Aggregate status rules (see the note_pages comment on the schema above):
// once a note has been explicitly saved from the review screen it stays
// 'reviewed' regardless of what a later page retry does to an individual
// page's status - "reviewed" means "the user has looked at and saved this
// note," which doesn't stop being true just because they retry one flagged
// page afterward. Before that first save, the note's status tracks its
// pages: still working if any page is, all-failed only if every page is,
// otherwise reviewable (which covers both "every page succeeded" and "some
// succeeded, some failed" - the review screen shows per-page state either
// way, so a partial failure never blocks reviewing the pages that did work).
function computeAggregateStatus(
  pages: NotePage[],
  currentStatus: NoteRow["status"]
): NoteRow["status"] {
  if (currentStatus === "reviewed") return "reviewed";
  if (pages.length === 0) return "uploaded";
  if (pages.some((p) => p.status === "uploaded" || p.status === "transcribing")) return "transcribing";
  if (pages.every((p) => p.status === "error")) return "error";
  return "ready_for_review";
}

export const notesRepo = {
  create(input: { id: string; title: string | null; createdAt: string }): void {
    db.prepare(
      `INSERT INTO notes (id, title, image_path, status, segments_ai, segments_current, created_at, updated_at)
       VALUES (?, ?, '', 'uploaded', '[]', '[]', ?, ?)`
    ).run(input.id, input.title, input.createdAt, input.createdAt);
  },

  // placeholderTitle is only ever applied via COALESCE, so a title the user
  // already set (or edited) is never clobbered by upload/retry - see
  // titleGen.ts. Only page 1 ever supplies one (see jobs.ts).
  setPlaceholderTitle(id: string, placeholderTitle: string | null, updatedAt: string): void {
    if (!placeholderTitle) return;
    db.prepare(`UPDATE notes SET title = COALESCE(title, ?), updated_at = ? WHERE id = ?`).run(
      placeholderTitle,
      updatedAt,
      id
    );
  },

  // Recomputes notes.status from its pages' current states (see
  // computeAggregateStatus above) and writes it if changed. Called after
  // every page-level state transition (enqueue/transcribed/error) so the
  // Library list's status column and the review screen's polling loop both
  // see an up-to-date aggregate without joining note_pages on every read.
  recomputeStatus(id: string, updatedAt: string): void {
    const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
    if (!row) return;
    const pages = getPagesForNote(id);
    const next = computeAggregateStatus(pages, row.status);
    if (next === row.status) return;
    db.prepare(`UPDATE notes SET status = ?, updated_at = ? WHERE id = ?`).run(next, updatedAt, id);
  },

  setReviewed(id: string, title: string | null, updatedAt: string): void {
    db.prepare(
      `UPDATE notes SET status = 'reviewed', title = COALESCE(?, title), updated_at = ?
       WHERE id = ?`
    ).run(title, updatedAt, id);
  },

  // folderId: null clears the folder (moves the note to "no folder").
  setFolder(id: string, folderId: string | null, updatedAt: string): void {
    db.prepare(`UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?`).run(
      folderId,
      updatedAt,
      id
    );
  },

  getById(id: string): Note | undefined {
    const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
    return row ? rowToNote(row) : undefined;
  },

  // Deletes the note row and (via ON DELETE CASCADE) its handwriting_examples.
  // Does not touch the uploaded image file - callers are responsible for that,
  // since this module doesn't otherwise deal in filesystem paths.
  delete(id: string): void {
    db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  },

  // folderId: undefined = no filter (all notes), null = only unfiled notes,
  // a string = only notes in that folder.
  listAll(query?: string, folderId?: string | null): Note[] {
    const rows =
      folderId === undefined
        ? (db.prepare(`SELECT * FROM notes ORDER BY created_at DESC`).all() as NoteRow[])
        : (db
            .prepare(`SELECT * FROM notes WHERE folder_id IS ? ORDER BY created_at DESC`)
            .all(folderId) as NoteRow[]);
    const notes = rows.map(rowToNote);
    if (!query) return notes;

    // Naive substring search over the current transcription text and title -
    // per claude/08-walking-skeleton-scope.md, hybrid/semantic search is
    // deferred; this just confirms notes are durably saved and retrievable.
    const q = query.toLowerCase();
    return notes.filter((n) => {
      const haystack = [n.title ?? "", ...n.segmentsCurrent.map((s) => s.text)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  },
};

export const notePagesRepo = {
  create(input: { id: string; noteId: string; pageNumber: number; imagePath: string; createdAt: string }): void {
    db.prepare(
      `INSERT INTO note_pages (id, note_id, page_number, image_path, status, segments_ai, segments_current, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'uploaded', '[]', '[]', ?, ?)`
    ).run(input.id, input.noteId, input.pageNumber, input.imagePath, input.createdAt, input.createdAt);
  },

  listForNote(noteId: string): NotePage[] {
    return getPagesForNote(noteId);
  },

  getById(id: string): NotePage | undefined {
    const row = db.prepare(`SELECT * FROM note_pages WHERE id = ?`).get(id) as NotePageRow | undefined;
    return row ? rowToPage(row) : undefined;
  },

  // Mirrors notesRepo.setTranscribing's old role, now per-page: set the
  // moment this page's processing_jobs row starts running/queued, so the
  // review screen can show "transcribing this page" instead of the terminal
  // 'uploaded' state it would otherwise be stuck on while queued.
  setTranscribing(id: string, updatedAt: string): void {
    db.prepare(`UPDATE note_pages SET status = 'transcribing', updated_at = ? WHERE id = ?`).run(
      updatedAt,
      id
    );
  },

  setTranscribed(id: string, segments: TranscriptSegment[], updatedAt: string): void {
    const json = JSON.stringify(segments);
    db.prepare(
      `UPDATE note_pages SET status = 'ready_for_review', segments_ai = ?, segments_current = ?, updated_at = ?
       WHERE id = ?`
    ).run(json, json, updatedAt, id);
  },

  setError(id: string, message: string, updatedAt: string): void {
    db.prepare(
      `UPDATE note_pages SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?`
    ).run(message, updatedAt, id);
  },

  // Called on Save (PATCH /api/notes/[id]) with this page's corrected
  // segments - a page keeps whatever status it already had (usually
  // 'ready_for_review'; 'error' pages have nothing to save since the review
  // screen never renders editable content for them).
  setSegments(id: string, segments: TranscriptSegment[], updatedAt: string): void {
    db.prepare(`UPDATE note_pages SET segments_current = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(segments),
      updatedAt,
      id
    );
  },
};

export interface FolderRow {
  id: string;
  name: string;
  created_at: string;
}

export const foldersRepo = {
  create(input: { id: string; name: string; createdAt: string }): void {
    db.prepare(`INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)`).run(
      input.id,
      input.name,
      input.createdAt
    );
  },

  listAll(): FolderRow[] {
    return db.prepare(`SELECT * FROM folders ORDER BY name ASC`).all() as FolderRow[];
  },

  getById(id: string): FolderRow | undefined {
    return db.prepare(`SELECT * FROM folders WHERE id = ?`).get(id) as FolderRow | undefined;
  },

  // Notes in this folder are reassigned to "no folder" first (04-data-model.md:
  // "the application layer [must] first reassign or null out notes.folder_id" -
  // deleting a folder must never delete the notes in it), then the folder row
  // itself is removed. Both statements run as one transaction so a crash
  // between them can't leave notes pointing at a folder_id that no longer
  // exists.
  delete(id: string): void {
    const tx = db.transaction((folderId: string) => {
      db.prepare(`UPDATE notes SET folder_id = NULL WHERE folder_id = ?`).run(folderId);
      db.prepare(`DELETE FROM folders WHERE id = ?`).run(folderId);
    });
    tx(id);
  },
};

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export const tagsRepo = {
  listAll(): { id: string; name: string }[] {
    return db.prepare(`SELECT id, name FROM tags ORDER BY name ASC`).all() as {
      id: string;
      name: string;
    }[];
  },

  // Case-insensitive find-or-create by normalized name (FR-7.6 / AC-9's
  // "reuse the existing tag rather than a near-duplicate being created"),
  // so "D&D" and "d&d" resolve to the same row and the first-ever spelling
  // wins for display.
  findOrCreate(name: string, createdAt: string): { id: string; name: string } {
    const normalized = normalizeTagName(name);
    const existing = db
      .prepare(`SELECT id, name FROM tags WHERE normalized_name = ?`)
      .get(normalized) as { id: string; name: string } | undefined;
    if (existing) return existing;

    const id = randomUUID();
    db.prepare(
      `INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)`
    ).run(id, name.trim(), normalized, createdAt);
    return { id, name: name.trim() };
  },
};

export const noteTagsRepo = {
  // Replaces the note's full tag set. Used both for the AI's initial
  // suggestions (source: 'ai') at upload time and for the user's edits from
  // the review screen (source: 'user') - see notes/[id]/route.ts PATCH.
  // Replacing rather than diffing is deliberate and simple for this phase:
  // the review screen always saves the complete current tag list, the same
  // pattern as segments_current.
  setForNote(
    noteId: string,
    tags: { tagId: string; source: "user" | "ai"; confidence: number | null }[],
    createdAt: string
  ): void {
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM note_tags WHERE note_id = ?`).run(noteId);
      const insert = db.prepare(
        `INSERT INTO note_tags (note_id, tag_id, confidence, source, created_at)
         VALUES (@noteId, @tagId, @confidence, @source, @createdAt)`
      );
      for (const t of tags) {
        insert.run({
          noteId,
          tagId: t.tagId,
          confidence: t.confidence,
          source: t.source,
          createdAt,
        });
      }
    });
    tx();
  },

  // Whether this note has ever had any tags recorded - used to gate the
  // one-time AI tag suggestion the same way titleGen.ts gates the
  // placeholder title, so a later retry doesn't silently re-add a tag the
  // user deliberately removed (AC-9: "does not silently reappear").
  hasAnyForNote(noteId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM note_tags WHERE note_id = ? LIMIT 1`).get(noteId);
    return Boolean(row);
  },
};

export const handwritingExamplesRepo = {
  create(input: {
    id: string;
    noteId: string;
    segmentId: string;
    aiText: string;
    correctedText: string;
    classification: string;
    learningWeight: number;
    originalConfidence: number | null;
    createdAt: string;
  }): void {
    db.prepare(
      `INSERT INTO handwriting_examples
        (id, note_id, segment_id, ai_text, corrected_text, classification, learning_weight, original_confidence, created_at)
       VALUES (@id, @noteId, @segmentId, @aiText, @correctedText, @classification, @learningWeight, @originalConfidence, @createdAt)`
    ).run(input);
  },

  listAll(): {
    id: string;
    note_id: string;
    segment_id: string;
    ai_text: string;
    corrected_text: string;
    classification: string;
    learning_weight: number;
    original_confidence: number | null;
    created_at: string;
  }[] {
    return db.prepare(`SELECT * FROM handwriting_examples ORDER BY created_at ASC`).all() as ReturnType<
      typeof handwritingExamplesRepo.listAll
    >;
  },
};

export interface VocabularyEntry {
  term: string;
  frequency: number;
}

export interface CorrectionPattern {
  fromPattern: string;
  toPattern: string;
  occurrences: number;
  lastConfirmedAt: string;
}

export interface HandwritingProfileRow {
  version: number;
  vocabulary: VocabularyEntry[];
  correctionPatterns: CorrectionPattern[];
  updatedAt: string;
}

export const handwritingProfileRepo = {
  get(): HandwritingProfileRow {
    const row = db.prepare(`SELECT * FROM handwriting_profile WHERE id = 1`).get() as
      | {
          version: number;
          vocabulary: string;
          correction_patterns: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      return { version: 0, vocabulary: [], correctionPatterns: [], updatedAt: "" };
    }
    return {
      version: row.version,
      vocabulary: JSON.parse(row.vocabulary),
      correctionPatterns: JSON.parse(row.correction_patterns),
      updatedAt: row.updated_at,
    };
  },

  upsert(profile: {
    vocabulary: VocabularyEntry[];
    correctionPatterns: CorrectionPattern[];
    updatedAt: string;
  }): void {
    db.prepare(
      `INSERT INTO handwriting_profile (id, version, vocabulary, correction_patterns, updated_at)
       VALUES (1, 1, @vocabulary, @correctionPatterns, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         version = version + 1,
         vocabulary = @vocabulary,
         correction_patterns = @correctionPatterns,
         updated_at = @updatedAt`
    ).run({
      vocabulary: JSON.stringify(profile.vocabulary),
      correctionPatterns: JSON.stringify(profile.correctionPatterns),
      updatedAt: profile.updatedAt,
    });
  },
};

export interface ProcessingJobRow {
  id: string;
  note_id: string;
  page_id: string | null;
  stage: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export const processingJobsRepo = {
  enqueue(input: { id: string; noteId: string; pageId: string; stage: string; createdAt: string }): void {
    db.prepare(
      `INSERT INTO processing_jobs (id, note_id, page_id, stage, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?)`
    ).run(input.id, input.noteId, input.pageId, input.stage, input.createdAt);
  },

  // Claims the oldest queued job atomically (single UPDATE...WHERE guarded by
  // status, not a separate SELECT-then-UPDATE) so two runner ticks can't both
  // pick up the same row - defensive even though this app only ever runs one
  // runner loop in one process today.
  claimNext(now: string): ProcessingJobRow | undefined {
    const next = db
      .prepare(`SELECT id FROM processing_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    if (!next) return undefined;

    const result = db
      .prepare(
        `UPDATE processing_jobs SET status = 'running', started_at = ?, attempts = attempts + 1
         WHERE id = ? AND status = 'queued'`
      )
      .run(now, next.id);
    if (result.changes === 0) return undefined; // lost the race (or already claimed)

    return db.prepare(`SELECT * FROM processing_jobs WHERE id = ?`).get(next.id) as ProcessingJobRow;
  },

  markSucceeded(id: string, finishedAt: string): void {
    db.prepare(`UPDATE processing_jobs SET status = 'succeeded', finished_at = ? WHERE id = ?`).run(
      finishedAt,
      id
    );
  },

  markFailed(id: string, error: string, finishedAt: string): void {
    db.prepare(
      `UPDATE processing_jobs SET status = 'failed', last_error = ?, finished_at = ? WHERE id = ?`
    ).run(error, finishedAt, id);
  },

  // Recovery for a runner that never comes back (process crash mid-job,
  // rather than a caught error) - a 'running' row past this age is assumed
  // orphaned and requeued, rather than left stuck forever. Called once at
  // runner startup (see jobs.ts), not on every tick.
  requeueOrphanedRunning(olderThanMs: number): number {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const result = db
      .prepare(`UPDATE processing_jobs SET status = 'queued' WHERE status = 'running' AND started_at < ?`)
      .run(cutoff);
    return result.changes;
  },
};

export default db;
