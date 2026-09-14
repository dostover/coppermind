# Inkwell — Phase 1: Functional Requirements

**Product:** Handwritten Notes AI ("Inkwell")
**Spec-DD Phase:** 1 of 7 (Requirements)
**Status:** Draft for review
**Date:** 2026-08-13

This document translates the Spec-DD product specification into explicit, numbered functional requirements, and separately calls out every ambiguity in the source spec along with the assumption made to resolve it. Requirements are grouped by capability area and tagged with their MVP priority from the spec's own scoping (§33): **[MUST]**, **[SHOULD]**, **[COULD]**, or **[OUT]** for explicit non-goals.

---

## 1. Accounts & Privacy

- FR-1.1 [MUST] A visitor can create an account (email + password, or equivalent) and sign in.
- FR-1.2 [MUST] All notes, documents, tags, folders, and handwriting-profile data are private to the owning user by default. No cross-user access exists in the MVP (no sharing/collaboration — see Non-Goals).
- FR-1.3 [MUST] An authenticated user can access their notes from multiple devices via the same account.
- FR-1.4 [MUST] A user can delete an individual note (transcription + metadata + relationships).
- FR-1.5 [MUST] A user can delete an original document/image independently of deleting the note (§25 — deleting the original must NOT delete the transcription).
- FR-1.6 [MUST] A user can delete their account, which cascades to deletion of all owned data (notes, documents, tags, folders, handwriting profile, embeddings).
- FR-1.7 [MUST] Basic data export (e.g., a JSON/ZIP bundle of notes + transcriptions) is available if feasible within MVP effort.
- FR-1.8 [MUST] The system stores and transmits only the minimum data required for each AI provider call (§26).

## 2. Capture & Upload

- FR-2.1 [MUST] A user can capture a page via device camera (mobile-optimized), upload a single image, upload a PDF, or upload multiple images/pages in one action.
- FR-2.2 [MUST] On supported mobile browsers, capture uses the native device camera via the browser's camera capture API.
- FR-2.3 [MUST] Before processing begins, the user can review captured/selected pages (reorder, remove, retake) and confirm.
- FR-2.4 [MUST] Multiple captured/uploaded pages can be explicitly grouped into a single logical multi-page note.
- FR-2.5 [MUST] Upload gives immediate feedback (the note appears in the library in a processing state) rather than blocking the UI until AI processing completes.

## 3. Document Processing Pipeline

- FR-3.1 [MUST] Each uploaded document is stored according to the configured retention policy (§25).
- FR-3.2 [MUST] The system identifies individual pages within a multi-page upload (PDF or multi-image).
- FR-3.3 [SHOULD] The system applies image preprocessing where useful: crop, deskew, rotate, contrast improvement, noise reduction. Preprocessing is best-effort; failure to preprocess must not block transcription.
- FR-3.4 [SHOULD] The system detects handwritten regions within a page (as distinct from, e.g., printed template lines or blank margins) to focus transcription.
- FR-3.5 [MUST] The system submits page(s) to the AI transcription provider and receives a transcription plus confidence/uncertainty data.
- FR-3.6 [MUST] The system preserves enough positional metadata (e.g., bounding regions per transcribed segment) to associate transcription text with source-image regions, where the underlying model provides it.
- FR-3.7 [MUST] Processing runs asynchronously as a pipeline with explicit, user-visible status (§28–29); the user may navigate away and return without losing progress.
- FR-3.8 [MUST] A failure at any pipeline stage is recoverable and does not corrupt or delete the uploaded document (§29, §37). The user can retry the failed stage.

## 4. AI Transcription

- FR-4.1 [MUST] Transcription faithfully reproduces the user's handwriting without grammar correction, rewriting, or "improvement" (§7).
- FR-4.2 [MUST] Transcription preserves structural elements where present: paragraphs, headings, lists (bulleted/numbered), line breaks, dialogue, tables (best-effort), cross-outs (marked, not silently removed), emphasis (e.g., underlining), and section relationships.
- FR-4.3 [MUST] Transcription and interpretation/analysis are performed as separate AI operations (§7, §31) — transcription must not inject semantic judgments.
- FR-4.4 [MUST] The transcription operation returns confidence information at a sub-document granularity (e.g., per word/phrase/span), not only a single document-level score.
- FR-4.5 [MUST] Any transcribed span below the configured confidence threshold is flagged as "review-required."
- FR-4.6 [MUST] The confidence threshold is configurable at the application level (not hardcoded).
- FR-4.7 [MUST] The system does not display a raw numerical confidence score to the user by default; it instead exposes a binary/tiered distinction (high-confidence vs. review-required) unless a numeric score is later found to be useful (§8).
- FR-4.8 [MUST] The user's accumulated Handwriting Profile (§11) is supplied as context to the transcription operation for that user's future documents.

## 5. Transcription Review

- FR-5.1 [MUST] The review screen displays the original document image alongside an editable transcription (split-screen on desktop; switchable or stacked on mobile).
- FR-5.2 [MUST] Review-required spans are visually distinct from high-confidence text, and this distinction is obvious, easy to locate, and easy to act on.
- FR-5.3 [MUST] The user can edit, delete, or add any text in the transcription, correct review-required spans, correct spans the AI marked high-confidence but got wrong, add missing paragraphs, and reformat structure.
- FR-5.4 [MUST] The user can save the note without resolving every review-required span (partial review is allowed; unresolved spans remain flagged post-save).
- FR-5.5 [SHOULD] Selecting a span of transcription text highlights the corresponding region on the original image, where positional metadata (FR-3.6) is available. Not required for MVP if it substantially raises implementation complexity.
- FR-5.6 [MUST] Saving a reviewed note persists the corrected transcription as the note's authoritative text without discarding the original AI output (both are retained for learning purposes, see §10–13).

## 6. Handwriting Learning

- FR-6.1 [MUST] Corrections are captured automatically as part of the normal save flow — no separate "teach AI" action is required from the user.
- FR-6.2 [MUST] For each correction, the system stores: the original handwriting image region (where determinable), the AI's original interpretation, the user's corrected text, a confidence value, the related note, and a timestamp — persisted as a `HandwritingExample`.
- FR-6.3 [MUST] The system classifies each correction as one of: handwriting-interpretation correction, content edit/rewrite, formatting change, or addition (§13), and assigns a learning weight accordingly. Handwriting-interpretation corrections receive full weight; other categories receive reduced or zero weight for learning purposes but are still saved as the note's content.
- FR-6.4 [MUST] When classification is uncertain, the correction is still stored as a `HandwritingExample` with a lower learning weight rather than discarded (§13).
- FR-6.5 [MUST] The system maintains a per-user `HandwritingProfile` aggregating verified examples, personal vocabulary (recurring proper nouns/terms), recurring correction patterns (pattern X → consistently corrected to Y), and confidence adjustments for previously-seen patterns.
- FR-6.6 [MUST] The Handwriting Profile is consulted by the transcription operation for all subsequent documents from that user (FR-4.8).
- FR-6.7 [MUST] The learning pipeline weights recent and repeatedly-confirmed corrections more heavily than a single one-off correction (§12).
- FR-6.8 [MUST] The Handwriting Profile is accessed only through an abstraction (`getHandwritingContext`, `recordHandwritingCorrection`, `updateHandwritingProfile`) so its internal implementation can evolve (e.g., to fine-tuned per-user models) without changing callers (§44).

## 7. Note Understanding, Summarization, Tags

- FR-7.1 [MUST] After a transcription is saved/reviewed, a separate AI stage classifies the note's type (open-ended set; not limited to a fixed enum — the AI may propose a new type).
- FR-7.2 [MUST] Summarization is adaptive to note type: the fields returned differ by type (e.g., brainstorm → core ideas/directions/open questions/connections; meeting notes → summary/decisions/action items/people/follow-ups; creative writing → scene summary/characters/locations/plot developments/concepts; to-do → tasks/deadlines/priorities; journal → summary/themes/events). No single fixed template is applied to every note.
- FR-7.3 [MUST] The user can edit the generated summary at any time; edits are not overwritten by later automated reprocessing without explicit user action (§32).
- FR-7.4 [MUST] The system generates tags for each note (topics, people, places, projects, concepts, events, note type, etc.).
- FR-7.5 [MUST] The user can remove, add, rename, and create tags, and reuse existing tags.
- FR-7.6 [MUST] Tag generation prefers matching an existing user tag over creating a near-duplicate (e.g., normalizes toward an established "D&D" rather than creating "Dungeons & Dragons") using the user's existing tag vocabulary as context.
- FR-7.7 [MUST] The system generates a note title when the user has not supplied one; the user can change it at any time, and AI must not silently overwrite a user-set title (§32).

## 8. Folders & Organization

- FR-8.1 [MUST] Users can create, rename, and nest folders at any time.
- FR-8.2 [MUST] A note belongs to at most one folder at a time (folder = single-parent placement) while independently having multiple tags.
- FR-8.3 [MUST] The AI may suggest a folder placement, but final placement is always a user action; AI never moves a note into a folder without user confirmation (§4.4, §32).

## 9. Relationships / Knowledge Graph

- FR-9.1 [MUST] The system computes and stores relationships between notes (e.g., same topic/person/project/place, similar idea, continuation, contradiction, supporting information, reference, derived idea) as first-class records, not merely as an emergent side effect of search.
- FR-9.2 [MUST] A note detail page surfaces at least a basic list of related notes (§33 "basic related-note functionality").
- FR-9.3 [SHOULD] A visual/interactive representation of relationships (beyond a list) is not required for MVP.
- FR-9.4 [MUST] Relationship storage is modeled so a graph-based traversal/visualization layer can be added later without a schema rewrite (§19).

## 10. Search

- FR-10.1 [MUST] Exact/substring text search over transcription content is supported.
- FR-10.2 [MUST] Keyword search (multi-term, relevance-ranked) is supported.
- FR-10.3 [MUST] Semantic search retrieves notes relevant to a query concept even when exact wording doesn't match.
- FR-10.4 [SHOULD] Natural-language question search retrieves relevant notes and synthesizes an answer grounded in them, with references back to source notes.
- FR-10.5 [MUST] Search covers: transcription text, corrected transcription, summaries, tags, folder names, extracted entities (when available), metadata, and semantic embeddings.
- FR-10.6 [MUST] Retrieval combines full-text/keyword search, vector/semantic search, and metadata filtering, with a re-ranking step over combined candidates — not vector similarity alone (§21).
- FR-10.7 [MUST] Each search result shows: title, short summary, matching snippet, folder, tags, date, and a relevance indicator; the user can open the full note. AI-synthesized answers always cite the underlying notes and never hide source material (§22).

## 11. Library & Note Detail UI

- FR-11.1 [MUST] A library view lists all notes with at least grid and list layouts, sorting, filtering, and folder/tag navigation; plus Recent, Favorites, Folders, Tags, and Trash sections (§23).
- FR-11.2 [MUST] A note detail page shows: header (title, folder, tags, date, actions), main content (corrected transcription, summary, AI metadata, related notes), and the original document (available per retention policy), plus actions (edit, reprocess, move, tag, delete, view related notes) (§24).

## 12. Retention

- FR-12.1 [MUST] Original documents are preserved by default and remain available during a configured retention period.
- FR-12.2 [SHOULD] Retention is configurable (e.g., permanent / 30 days / 90 days / 1 year / until manually deleted); MVP may ship a simplified subset of these options.
- FR-12.3 [MUST] The system never auto-deletes an original document without an explicit, user-configured retention policy in effect (§34 — no automatic deletion without clear configuration).
- FR-12.4 [MUST] Deleting an original document leaves the transcription, summary, tags, and note record intact; the UI clearly indicates the transcription is derived from a (possibly no-longer-available) original.

## 13. Error Handling

- FR-13.1 [MUST] The system handles, without corrupting the document or losing the upload: unreadable handwriting, poor lighting, blur, mixed handwriting styles, crossed-out text, embedded drawings, mixed print/cursive, multiple languages, blank pages, very large documents, AI timeout, AI provider failure, embedding failure, search-indexing failure, and duplicate uploads.
- FR-13.2 [MUST] Every recoverable error surfaces a clear, actionable message (e.g., "Transcription failed. Try again.") and the user can retry the failed stage without re-uploading.
- FR-13.3 [MUST] A duplicate upload (same content re-uploaded) is detected and surfaced to the user rather than silently creating an unexplained duplicate note (exact detection mechanism is an implementation decision).

## 14. AI Architecture (cross-cutting)

- FR-14.1 [MUST] All AI calls go through a provider-agnostic `AIProvider` interface (`transcribe`, `analyzeNote`, `summarize`, `generateTags`, `extractEntities`, `identifyRelationships`, `answerSearchQuery`); no application code is coupled to a specific model/version identifier.
- FR-14.2 [MUST] Claude is the default/primary implementation of `AIProvider`, but the architecture allows swapping in a specialized OCR/vision model for the transcription step alone while Claude continues to perform interpretation/reasoning steps.
- FR-14.3 [MUST] Each AI task (transcription, confidence assessment, classification, summarization, tagging, entity extraction, relationship detection, search answering, handwriting-learning evaluation) uses its own narrowly-scoped prompt/contract rather than one monolithic prompt (§31).
- FR-14.4 [MUST] AI operations return structured (schema-validated) output wherever practical rather than free-form prose requiring fragile parsing (§41 Phase 5).

## 15. Human-in-the-Loop (cross-cutting)

- FR-15.1 [MUST] AI-generated transcription, summary, tags, folder suggestions, relationships, and titles are always user-editable.
- FR-15.2 [MUST] No automated reprocessing (e.g., a "reprocess" action or background re-analysis) overwrites content the user has explicitly confirmed/edited without an explicit user action authorizing the overwrite.

## 16. Security (cross-cutting)

- FR-16.1 [MUST] All data access is authenticated and authorized per-user; no endpoint returns another user's notes, documents, or handwriting profile.
- FR-16.2 [MUST] File storage is access-controlled (no public/guessable URLs to original documents).
- FR-16.3 [MUST] AI provider credentials are held server-side only; never exposed to the client.
- FR-16.4 [MUST] Logs do not contain full note/document contents unless explicitly required for a specific, justified debugging purpose, and are scoped/redacted accordingly.
- FR-16.5 [MUST] A user can request permanent deletion of their account data, and the system supports actually carrying that out (not just soft-hiding).

## 17. Performance (cross-cutting)

- FR-17.1 [MUST] Upload provides feedback within roughly 1 second (optimistic note creation in "uploaded" state) — no synchronous wait on AI processing.
- FR-17.2 [MUST] All AI operations after upload run asynchronously; the UI reflects pipeline status changes without requiring a manual refresh (e.g., via polling or push updates).
- FR-17.3 [SHOULD] Search returns results within roughly 1 second for a personal library in the hundreds-to-low-thousands of notes range.
- FR-17.4 [SHOULD] The architecture does not require a fundamental redesign to scale to thousands of notes per user.

---

## Explicit Non-Goals for MVP (from §34 — restated as requirements NOT to build)

- OUT-1 Social features, public note sharing, collaboration, or a marketplace.
- OUT-2 Complex workflow automation.
- OUT-3 Native iOS/Android applications (web only, mobile-optimized).
- OUT-4 Fully autonomous note organization (AI never finalizes organization without the user).
- OUT-5 Model fine-tuning infrastructure (the Handwriting Profile is structured data, not a fine-tuned model, in MVP).
- OUT-6 Complex graph visualization UI.
- OUT-7 Automatic deletion of originals absent explicit user-configured retention.

---

## Ambiguities in the Source Spec & Assumptions Made

| # | Ambiguity | Assumption |
|---|---|---|
| A1 | Spec doesn't specify sign-up method (email/password vs. OAuth vs. magic link). | MVP uses email + password with standard verification; OAuth (Google) can be added later without schema change (User entity is provider-agnostic). |
| A2 | "Confidence threshold configurable at the application level" — configurable by whom? | Assumption: a global default set by the application (not per-user in MVP), stored as an app setting; per-user override is a post-MVP enhancement. |
| A3 | Whether note-to-folder is strictly single-parent or a note could appear in multiple folders. | Assumption: single folder per note (like a filesystem), consistent with the `folder_id` singular field on Note in §27's data model. Tags provide the multi-membership axis. |
| A4 | Exact set of relationship types algorithmically detected in MVP vs. left for later. | Assumption: MVP computes a minimal set automatically (same-entity/topic overlap via shared tags/entities + embedding similarity above a threshold); richer types (contradiction, derived idea) are inferred opportunistically by the relationship-detection AI call but not guaranteed for every note pair. |
| A5 | Whether "handwriting example" image regions require precise per-word bounding boxes or coarser page/line regions. | Assumption: MVP stores the best-available region granularity from the vision model's output (which may be line- or phrase-level rather than word-level); the schema does not require word-level precision. |
| A6 | Data export format ("if practical"). | Assumption: MVP export is a JSON manifest of notes/transcriptions/tags/folders plus a ZIP of original images still in retention; full fidelity re-import is out of scope. |
| A7 | Whether "duplicate upload" detection is exact-file-hash or perceptual/near-duplicate. | Assumption: MVP uses exact content-hash detection only; near-duplicate/perceptual detection is a future enhancement. |
| A8 | Numeric confidence score — spec says don't show it "unless proves useful." | Assumption: MVP never surfaces the raw number in the primary UI; it may be exposed in a debug/settings view for power users. Two-tier (ok / needs-review) is the default treatment. |
| A9 | "Basic related-note functionality" scope for MVP vs. Should-have "related-note visualization." | Assumption: MVP shows a simple ranked list of related notes (title + relationship type) on the note detail page; timeline/graph visualization is Should-have, not required for Definition of Done. |
| A10 | Multi-language handling — spec lists it as an error case to "handle," not a feature to fully support. | Assumption: MVP transcribes non-English/mixed-language handwriting best-effort using Claude's native multilingual capability, without dedicated per-language tuning; it must not crash or silently drop content. |

---

*Next: Phase 2 — Architecture.*
