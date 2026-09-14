# Inkwell — Phase 2: Architecture

**Spec-DD Phase:** 2 of 7 (Architecture)
**Status:** Draft for review
**Date:** 2026-08-13

Section 40 leaves stack choice to the project and asks for "simple architecture, prefer managed services." This document proposes a concrete, boring, replaceable stack that satisfies every architectural constraint in the spec (AI abstraction, hybrid search, async pipeline, evolvable handwriting profile) without introducing infrastructure the MVP doesn't need.

---

## 1. Proposed Stack (assumption — confirm before implementation)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React, TypeScript), mobile-first responsive CSS | Single codebase for web + easy camera-capture via `<input capture>` / `getUserMedia`; SSR for fast library loads. |
| API layer | Next.js API routes / a thin Node (Fastify) service — same TypeScript codebase | Avoids a second language/runtime for MVP; can be split into a standalone service later without touching contracts. |
| Relational DB | PostgreSQL | Strong relational integrity for Notes/Folders/Tags/Relationships; supports JSONB for flexible AI-output fields. |
| Vector search | `pgvector` extension on the same Postgres instance | Avoids standing up a separate vector DB for MVP scale (thousands of notes/user); swappable for a dedicated vector store later since embeddings are accessed through a `SearchIndex` abstraction, not raw SQL scattered through the app. |
| Full-text search | Postgres `tsvector`/`GIN` index (MVP) | Same rationale — one datastore, upgradeable to Elasticsearch/OpenSearch later behind the same abstraction if scale demands it. |
| Object storage | S3-compatible bucket (e.g., S3 or R2), private, signed URLs | Standard, managed, cheap; matches "secure file storage" requirement (§38). |
| Async jobs | Postgres-backed job queue (e.g., `pg-boss`) or a managed queue (SQS) driving worker processes | Keeps infra minimal (no separate broker required) while giving the pipeline real async, retryable steps (§28). |
| Auth | Managed auth provider (e.g., Auth.js / Clerk) issuing session cookies + JWT for API calls | Avoids hand-rolling password storage; supports future OAuth without schema change. |
| AI provider | Claude (Anthropic API), vision-capable model for transcription, text model for reasoning tasks | Per §30, Claude is primary; access exclusively through the `AIProvider` interface (§6 below). |
| Embeddings | Provided by an `EmbeddingProvider` interface; default implementation calls an embedding-capable model | Kept separate from `AIProvider` since embedding is a distinct capability that may use a different provider/model than reasoning. |

This is a single deployable web app + a pool of background workers + Postgres + object storage. No message broker, no separate vector DB, no microservices — consistent with §40's "do not introduce unnecessary infrastructure."

---

## 2. System Diagram

```
                         ┌─────────────────────┐
                         │   Web Frontend       │
                         │  (Next.js, mobile-   │
                         │   optimized capture)  │
                         └──────────┬───────────┘
                                    │ HTTPS (session auth)
                         ┌──────────▼───────────┐
                         │   API Layer            │
                         │  (auth, CRUD, search,  │
                         │   enqueue jobs)         │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼───────────────────┐
                 │                  │                     │
        ┌────────▼───────┐ ┌────────▼────────┐  ┌─────────▼────────┐
        │  Postgres        │ │ Object Storage   │  │  Job Queue        │
        │ (notes, tags,    │ │ (original pages, │  │ (pg-boss/SQS)     │
        │  folders, rels,  │ │  private, signed  │  │                    │
        │  handwriting     │ │  URLs)            │  │                    │
        │  profile,        │ └───────────────────┘  └─────────┬──────────┘
        │  embeddings,                                          │
        │  full-text idx)                                       │
        └──────────────────┘                            ┌───────▼────────┐
                                                          │ Processing       │
                                                          │ Orchestrator      │
                                                          │ (worker pool)     │
                                                          │  ├ Preprocess     │
                                                          │  ├ Transcribe     │
                                                          │  ├ Confidence     │
                                                          │  ├ Handwriting    │
                                                          │  │  Profile Update│
                                                          │  ├ Note Analysis  │
                                                          │  ├ Summarize      │
                                                          │  ├ Tag/Entities   │
                                                          │  ├ Embeddings     │
                                                          │  └ Relationships  │
                                                          └───────┬────────┘
                                                                  │
                                                          ┌───────▼────────┐
                                                          │  AIProvider      │
                                                          │  abstraction     │
                                                          │  (Claude today)  │
                                                          └──────────────────┘
```

---

## 3. Application Architecture

- **Frontend ↔ API**: the frontend never calls the AI provider or object storage directly. It uploads via a signed-URL flow (API issues a short-lived signed PUT URL; browser uploads the image straight to storage; browser confirms completion to the API), keeping large binary payloads off the API server.
- **API layer responsibilities**: authentication/session validation, per-user authorization on every query, CRUD for notes/folders/tags, search endpoint, and enqueueing pipeline jobs. The API layer does not itself call Claude synchronously for anything on the pipeline (transcription, summarization, etc.) — those are worker-only, so a slow/failed AI call never blocks an HTTP request. The one exception is the natural-language search-answering call (§10.4), which is short-lived and can run request-scoped with a timeout and graceful fallback to plain retrieval results.
- **Worker pool (Processing Orchestrator)**: consumes jobs from the queue, one job type per pipeline stage (§28). Each stage is its own idempotent job so it can be retried independently without re-running earlier (already-succeeded) stages.
- **Statelessness**: API and worker processes are stateless; all durable state lives in Postgres/object storage, so either tier can be scaled horizontally.

## 4. Authentication & Authorization

- Session-based auth for the web app (HTTP-only secure cookie); API requests re-validate the session on every call.
- Every database query for user-owned entities (notes, documents, tags, folders, handwriting profile, embeddings) is scoped by `user_id` at the query layer — enforced by a single shared data-access module, not ad hoc per-endpoint, to prevent an accidental cross-user leak (FR-16.1).
- Row-level security in Postgres is used as a second line of defense in addition to application-layer scoping, given the sensitivity of handwriting/personal-note data.
- Signed URLs for object storage are short-lived and scoped to a single object; the storage bucket itself is fully private.
- AI provider API keys live only in worker/server environment configuration, never shipped to the client bundle (FR-16.3).

## 5. AI Architecture

### 5.1 `AIProvider` interface (§30)

A single interface with one implementation per concern; all callers depend on the interface, never on `Claude*` types directly:

```
interface AIProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>
  analyzeNote(input: AnalyzeNoteInput): Promise<AnalyzeNoteOutput>
  summarize(input: SummarizeInput): Promise<SummarizeOutput>
  generateTags(input: GenerateTagsInput): Promise<GenerateTagsOutput>
  extractEntities(input: ExtractEntitiesInput): Promise<ExtractEntitiesOutput>
  identifyRelationships(input: RelationshipInput): Promise<RelationshipOutput>
  answerSearchQuery(input: SearchAnswerInput): Promise<SearchAnswerOutput>
  evaluateHandwritingCorrection(input: LearningEvalInput): Promise<LearningEvalOutput>
}
```

(Full I/O schemas are defined in Phase 5 — AI Contracts.)

- The default implementation (`ClaudeAIProvider`) calls the Anthropic Messages API, using a distinct, narrowly-scoped system prompt per method (§31) — never one shared mega-prompt.
- Each method call is versioned (the specific Claude model string lives in config, not scattered in code) so a model upgrade is a config change, not a refactor.
- `transcribe()` is the one method allowed to be backed by a *different* provider than the rest (e.g., a specialized OCR/vision model), per §30/FR-14.2. This is achieved by letting `transcribe()` be independently swappable via config (`TRANSCRIPTION_PROVIDER=claude|<other>`), while `analyzeNote`, `summarize`, etc. remain on Claude, which receives the transcription text (not the image) for reasoning tasks.
- A `MockAIProvider` implementation exists from day one for tests/local dev, so application logic never requires live API access to run.

### 5.2 Embeddings

- A parallel `EmbeddingProvider` interface (`embed(text: string): number[]`) decouples embedding generation from reasoning, since these commonly use a different, cheaper model. Embeddings are generated for: the full note transcription (chunked if long), the summary, and optionally per-paragraph segments (for finer-grained semantic search) — see Phase 5.

### 5.3 Handwriting Profile as an abstraction (§44)

The rest of the app — and every `AIProvider` call — accesses handwriting knowledge only through:

```
getHandwritingContext(userId): HandwritingContext   // compact context injected into transcribe() prompts
recordHandwritingCorrection(userId, correction): void // called during save-corrections
updateHandwritingProfile(userId): void                 // recomputes vocabulary/patterns/adjustments
```

`HandwritingContext` is a bounded-size summary (not the full example history) suitable for prompt injection: top personal vocabulary terms, the most confident recurring correction patterns, and any global confidence adjustments. The MVP implementation derives this deterministically from the `HandwritingExample`/`HandwritingProfile` tables (see Phase 4). Because callers only ever see `HandwritingContext`, the underlying implementation can later be replaced by a per-user embedding index or a fine-tuned adapter (§14, §44) without touching `transcribe()`'s caller.

## 6. File Storage Architecture

- Original page images/PDFs are uploaded directly to a private object-storage bucket via signed URLs (see §3).
- Storage key convention: `users/{user_id}/notes/{note_id}/pages/{page_id}/original.{ext}`, plus a `preprocessed.{ext}` variant for the cleaned-up image used in transcription.
- Retention (§25) is enforced by a scheduled job that checks each `Document`'s `retention_status`/expiry and deletes the object (not the DB row's transcription linkage) when it lapses, updating `Document.storage_location` to null and flagging the page as "original removed."
- All access to original images from the frontend goes through short-lived signed GET URLs issued by the API after an authorization check — never a permanently public URL.

## 7. Search Architecture

Implements the hybrid pipeline from §21:

```
Query
  → Query Understanding (classify: exact/keyword vs. natural-language question; extract any explicit filters like tags/folder/date mentioned)
  → parallel:
        Keyword/full-text search (Postgres tsvector, ranked by ts_rank)
        Semantic search (pgvector cosine similarity over note/segment embeddings)
        Metadata filter (tags, folder, date range, note type — applied as SQL predicates)
  → Candidate union (dedup by note_id, keep best score per source)
  → Re-ranking (weighted blend of keyword score + semantic score + recency + relationship-boost if the query matched an entity shared with other notes)
  → Top-N relevant notes
  → (if natural-language question) AIProvider.answerSearchQuery(topN, query) → cited answer
  → Search Results UI (always shows the underlying notes, never only the synthesized answer)
```

- Full-text and vector search both live in Postgres for MVP; both are accessed through a single `SearchIndex` module (`indexNote(note)`, `search(query, filters)`) so the underlying engine can be swapped (e.g., to OpenSearch + a dedicated vector DB) without changing callers, satisfying §17.4/FR-17.4.
- Indexing is asynchronous: the `INDEX FOR SEARCH` pipeline stage (§28) updates both the tsvector column and the embedding rows whenever a note's transcription, summary, or tags change.

## 8. Processing Pipeline (§28) — Architecture

Each pipeline stage is a discrete, idempotent, retryable job keyed by `note_id` (and `page_id` where relevant):

```
UPLOAD → PREPROCESS → TRANSCRIBE → CONFIDENCE_ANALYSIS → [ready_for_review, pipeline pauses]
  → (user reviews/saves) → SAVE_CORRECTIONS → UPDATE_HANDWRITING_PROFILE
  → ANALYZE_NOTE → GENERATE_SUMMARY → GENERATE_TAGS → EXTRACT_ENTITIES
  → GENERATE_EMBEDDINGS → IDENTIFY_RELATED_NOTES → INDEX_FOR_SEARCH → READY
```

- The pipeline **pauses** after `CONFIDENCE_ANALYSIS` and waits for the user's review/save — it is not a single unbroken background chain; §28 explicitly interleaves `USER REVIEW` and `SAVE CORRECTIONS`.
- Each stage transition updates `Note.processing_status` (Phase 4/§29 enumerates the states) and is visible to the frontend via polling (MVP) or a lightweight push channel (post-MVP) so the user sees live progress without a manual refresh (FR-17.2).
- A stage failure sets `processing_status = error` with a stage-specific error code/message, leaves all prior stage outputs intact, and offers a retry action that re-enqueues only the failed stage (FR-3.8, FR-13.2).
- Large/multi-page documents are processed page-by-page for TRANSCRIBE/CONFIDENCE_ANALYSIS (parallelizable), then merged into one logical note before ANALYZE_NOTE onward, since note-level understanding needs the full document.

## 9. Handwriting-Learning Architecture (§11–14, §44)

```
Note saved with corrections
  → diff transcription (pre-edit AI output) vs. (post-edit user text), segment by segment
  → for each changed segment:
        AIProvider.evaluateHandwritingCorrection(original_ai_text, corrected_text, surrounding_context, source_image_region?)
          → classification: handwriting_correction | content_edit | rewrite | formatting | addition
          → learning_weight (0–1)
  → persist each as a HandwritingExample row
  → UPDATE_HANDWRITING_PROFILE job recomputes, from the user's HandwritingExample history:
        - personal_vocabulary: terms/names that recur across ≥2 examples or are flagged as proper nouns/unusual tokens
        - correction_patterns: (ai_pattern → corrected_pattern) pairs with count ≥ 2 and a recency-weighted confidence
        - confidence_adjustments: per-pattern adjustment applied to future confidence scoring for matching spans
  → HandwritingProfile.version incremented; updated_at set
  → next transcribe() call for that user fetches getHandwritingContext(userId) and injects it into the transcription prompt
```

- This pipeline is entirely data-driven (no model training step) in MVP, satisfying §11's "do not fine-tune after every correction" and §14's "these [advanced techniques] should not be required for MVP."
- The abstraction boundary (§5.3 above) is what allows a future swap to a fine-tuned/embedding-based approach: `updateHandwritingProfile` could later train a small per-user adapter instead of recomputing pattern tables, with no change to `transcribe()` or the review UI.

## 10. Observability & Safety (cross-cutting)

- Structured logs record pipeline stage transitions, job durations, and error codes — keyed by `note_id`/`user_id` as opaque IDs, never note content (FR-16.4).
- AI provider calls are logged with token counts/latency/model version for cost and performance monitoring, not with prompt/response bodies in default log level.
- Rate limiting and per-user quotas on upload/processing guard against runaway cost from a single account.

---

*Next: Phase 3 — UX (primary screens and interactions).*
