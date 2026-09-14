# Inkwell — Phase 6: Acceptance Criteria

**Spec-DD Phase:** 6 of 7 (Acceptance Criteria)
**Status:** Draft for review
**Date:** 2026-08-13

Given/When/Then acceptance criteria for every major MVP feature, per §41 Phase 6's example format. Traces back to the numbered requirements in Phase 1.

---

### AC-1 Account Creation & Sign-In
*Covers FR-1.1–1.3*

- Given a new visitor, when they submit a valid email and password, then an account is created and they land signed-in on an empty Library.
- Given an existing user on a new device, when they sign in with valid credentials, then they see the same notes, folders, and tags as on their original device.
- Given an existing user, when they enter an incorrect password, then sign-in is rejected with a clear error and no session is created.

### AC-2 Capture & Multi-Page Upload
*Covers FR-2.1–2.5*

- Given a mobile browser with camera support, when the user opens Capture, then the device camera opens directly for photographing a page.
- Given the user has captured 3 pages in one session, when they choose "Save as one note," then a single note is created containing all 3 pages in the order shown in the review filmstrip.
- Given the user is mid-capture, when they remove one of the reviewed pages, then that page is excluded from the resulting note and no upload occurs for it.
- Given any successful upload submission, when the user is returned to the Library, then the new note appears immediately in a non-`ready` processing state (not blocked behind AI processing).

### AC-3 Document Processing Pipeline
*Covers FR-3.1–3.8*

- Given a newly uploaded multi-page document, when processing begins, then each page is identified and preprocessed independently before transcription.
- Given a page with poor lighting or blur, when preprocessing runs, then the pipeline still proceeds to transcription (preprocessing failure does not block the pipeline).
- Given transcription succeeds, when the pipeline continues, then the note reaches `ready_for_review` with per-segment confidence data attached.
- Given a pipeline stage fails (e.g., AI provider timeout), when the user views the note, then it shows `error` status naming the failed stage, the originally uploaded document is intact and unmodified, and a Retry action is available.
- Given the user retries a failed stage, when the retry succeeds, then the pipeline resumes from that stage without re-running already-succeeded prior stages.

### AC-4 Transcription Faithfulness
*Covers FR-4.1–4.3*

- Given a handwritten page with a numbered list, a heading, and a crossed-out word, when transcribed, then the output preserves the numbered list structure, marks the heading as a heading, and marks the crossed-out word as crossed-out rather than omitting or silently correcting it.
- Given handwriting with informal grammar or spelling, when transcribed, then the output reproduces it as written, without grammar correction or rewriting.

### AC-5 Confidence & Uncertainty Marking
*Covers FR-4.4–4.7, §8*

- Given a transcription with segments below the configured confidence threshold, when the review screen renders, then those segments are visually marked as review-required, distinct from high-confidence text, without displaying a raw numeric score.
- Given the application-level confidence threshold is changed in configuration, when a *previously transcribed* note is re-rendered, then review-required flags are recomputed against the new threshold using the stored per-segment confidence (no re-transcription required).

### AC-6 Transcription Review & Correction
*Covers FR-5.1–5.6, §36*

- Given a note in `ready_for_review`, when the user opens it, then they see the original image and the editable transcription together (split or switchable per device).
- Given a review-required segment, when the user corrects it, then its review-required flag clears immediately and the corrected text is retained.
- Given a high-confidence segment that is nonetheless wrong, when the user edits it directly, then the edit is accepted and saved exactly as any other correction.
- Given the user has resolved only some of the flagged segments, when they click Save, then the note saves successfully with the remaining segments still flagged for future reference — the save is not blocked.
- Given the user selects a span of transcription text and source-region metadata exists for it, when selected, then the corresponding region of the original image is highlighted.

### AC-7 Handwriting Learning
*Covers FR-6.1–6.8, §13*

- Given the user corrects a transcription and saves, when the save completes, then `HandwritingExample` rows are created automatically, with no separate "teach AI" step taken by the user.
- Given a correction changes "Rilldaie" to "Rilldale" (a plausible handwriting misread), when evaluated, then it is classified as `handwriting_correction` with a high learning weight.
- Given a correction changes "3" to "4" in a sentence about a meeting time (a factual change, not a misread), when evaluated, then it is classified as `content_edit` (or similar) with a low/zero learning weight, and is still saved as the note's authoritative text.
- Given classification confidence is low for a given correction, when evaluated, then the example is still stored with a reduced (not zero) learning weight.
- Given the user has previously corrected the same handwriting pattern 3 times consistently, when a new page containing that pattern is transcribed, then the transcription is measurably more likely to produce the corrected form and/or exhibit an adjusted confidence for that pattern, versus a first-time occurrence.
- Given a single unusual/contradictory correction occurs once, when the profile is recomputed, then it does not override an established, repeatedly-confirmed correction pattern.

### AC-8 Note Understanding & Adaptive Summarization
*Covers FR-7.1–7.3, §15–16*

- Given a saved note whose content resembles a to-do list, when analyzed, then `noteType` is classified accordingly and the generated summary contains tasks/deadlines/priorities fields rather than the brainstorm or meeting-notes field set.
- Given content that doesn't fit any previously-seen note type, when analyzed, then the system proposes a new type rather than forcing it into an existing category.
- Given a user edits the generated summary, when a later reprocessing event occurs (e.g., manual Reprocess), then the user's edited summary is not silently overwritten without an explicit user action.

### AC-9 Tags
*Covers FR-7.4–7.6*

- Given a note's content mentions a concept the user has already tagged elsewhere as "D&D," when tags are generated, then the existing "D&D" tag is reused rather than a near-duplicate ("Dungeons & Dragons") being created.
- Given the user removes an AI-suggested tag, when they save, then that tag no longer appears on the note (and does not silently reappear on the next reprocessing).
- Given the user creates a new tag manually, when they apply it, then it becomes available for reuse (including AI suggestion) on future notes.

### AC-10 Titles
*Covers FR-7.7*

- Given the user did not supply a title, when processing completes, then an AI-generated title appears.
- Given the user has set/edited a title, when the note is later reprocessed, then the user's title is preserved and not overwritten.

### AC-11 Folders
*Covers FR-8.1–8.3*

- Given the user creates a new folder, when they place a note in it, then the note appears under that folder in the Library and nowhere else simultaneously.
- Given the AI suggests a folder for a note, when the suggestion is shown, then the note is not moved until the user explicitly confirms.

### AC-12 Note Relationships
*Covers FR-9.1–9.4*

- Given two notes written months apart both mention "Rilldale," when relationship detection runs on the newer note, then a relationship record linking the two notes is created and surfaced in each note's related-notes list.
- Given a note has no meaningfully related notes, when viewed, then the related-notes section shows an appropriate empty state rather than an error.

### AC-13 Search — Exact & Keyword
*Covers FR-10.1–10.2, FR-10.5*

- Given a note contains the exact word "Rilldale," when the user searches "Rilldale," then that note appears in results.
- Given a multi-term keyword query like "wizard tower," when searched, then notes containing both/either term are returned, ranked by relevance.
- Given a query matches a tag or folder name but not the transcription body, when searched, then the note still appears in results (search covers tags/folders/metadata, not transcription alone).

### AC-14 Search — Semantic & Natural Language
*Covers FR-10.3–10.4, §20*

- Given a note discusses "the wizard and the village distrust each other" without using the word "relationship," when the user searches "what did I write about the wizard's relationship with the village," then that note is returned via semantic match.
- Given a natural-language question with relevant notes in the library, when searched, then a synthesized answer is shown with citations linking to the specific source notes, and those source notes also appear in the results list beneath the answer.
- Given a natural-language question with no relevant notes, when searched, then the system indicates no relevant notes were found rather than fabricating an answer.

### AC-15 Search Results Presentation
*Covers FR-10.6–10.7*

- Given any search, when results render, then each result shows title, summary snippet, matching snippet, folder, tags, date, and a relevance ordering.
- Given the user clicks a result, when the note detail opens, then it is the full, complete note (search never shows a truncated or answer-only view as a dead end).

### AC-16 Library & Note Detail
*Covers FR-11.1–11.2*

- Given the user has notes in various processing states, when viewing the Library, then All Notes/Recent/Favorites/Folders/Tags/Trash are all reachable and each note's processing state is visible without opening it.
- Given a fully processed note, when opened, then the detail page shows title, folder, tags, date, corrected transcription, summary, related notes, and (if in retention) the original image, plus edit/reprocess/move/tag/delete actions.

### AC-17 Retention
*Covers FR-12.1–12.4, §25*

- Given a note has just been processed, when viewed, then the original image is available regardless of retention setting (originals are preserved by default).
- Given a user-configured retention period has elapsed for a document, when the retention job runs, then the original image is removed from storage while the note's transcription, summary, and tags remain fully intact and accessible.
- Given an original has been removed by retention, when the note detail page is viewed, then it clearly indicates the original is no longer available rather than showing a broken image.
- Given the user explicitly deletes only the original image (not the whole note), when confirmed, then the transcription remains and the note is otherwise unaffected.

### AC-18 Account & Data Deletion, Export
*Covers FR-1.4–1.8, §26*

- Given the user deletes an individual note, when confirmed, then the note, its documents, tags associations, embeddings, and relationships are removed; unrelated notes are unaffected.
- Given the user requests account deletion, when confirmed (with explicit typed confirmation), then all owned notes, documents, folders, tags, and the handwriting profile are scheduled for permanent removal.
- Given the user requests a data export, when generated, then a downloadable bundle containing their notes/transcriptions/tags/folders is produced.
- Given any two distinct user accounts, when either browses their library or searches, then neither can see or retrieve the other's notes or handwriting profile under any circumstance.

### AC-19 Error Handling & Resilience
*Covers FR-13.1–13.3, §37*

- Given a blank page is uploaded, when processed, then the pipeline completes without error and the note is marked as having no meaningful transcribed content (not a failure state).
- Given a duplicate file is uploaded (identical content hash to an existing document), when detected, then the user is informed rather than a silent, unexplained duplicate note being created.
- Given an AI provider call times out or errors, when the pipeline stage fails, then the uploaded original document remains fully intact and the note is left in a recoverable `error` state.

### AC-20 AI Abstraction & Human-in-the-Loop
*Covers FR-14.1–14.4, FR-15.1–15.2*

- Given the AI provider or model version is changed in configuration, when the app is redeployed, then no application code outside the provider implementation requires modification.
- Given any AI-generated field (title, summary, tags, folder suggestion, relationships) is displayed, when the user edits and saves it, then a subsequent automated reprocessing pass does not overwrite that user edit without an explicit user-initiated action (e.g., manual Reprocess with confirmation).

### AC-21 Security
*Covers FR-16.1–16.5, §38*

- Given an authenticated request for another user's note by ID, when made, then the API returns an authorization error, not the note's data.
- Given application logs are inspected under normal operation, when reviewed, then they do not contain full note transcription or image content.
- Given a client-side network inspection, when performed, then no AI provider API key or credential is present in any request or bundle sent to the browser.

### AC-22 Performance
*Covers FR-17.1–17.4*

- Given a user uploads a page, when the upload completes, then the note appears in the Library within ~1 second, without waiting for any AI processing to finish.
- Given a user issues a search against a library of a few hundred notes, when submitted, then results render within approximately 1 second under normal conditions.

---

## Definition of Done Cross-Check (§42)

Each numbered item in the spec's Definition of Done maps to acceptance criteria above:

| DoD Item | Covered by |
|---|---|
| 1. Create account | AC-1 |
| 2–4. Photograph, upload/process | AC-2, AC-3 |
| 5. Receive transcription | AC-4 |
| 6. See uncertain portions marked | AC-5 |
| 7. Correct transcription | AC-6 |
| 8. Save corrected note | AC-6 |
| 9. System learns from corrections | AC-7 |
| 10. AI title & summary | AC-8, AC-10 |
| 11. AI tags | AC-9 |
| 12. Place note in folder | AC-11 |
| 13. Upload additional notes | AC-2 (repeatable) |
| 14. Keyword search | AC-13 |
| 15. Natural-language search | AC-14 |
| 16. Semantically related notes | AC-12, AC-14 |
| 17. Open original document | AC-16, AC-17 |
| 18. Edit transcription later | AC-6, AC-16 (Edit action) |
| 19. Delete note / original | AC-17, AC-18 |
| 20. Access from another device | AC-1 |
| 21. Measurable improvement recognizing recurring patterns | AC-7 |

---

*End of Phase 1–6 documentation set. Phase 7 (Implementation) begins with the thin vertical prototype described in spec §43: one page → transcribe → confidence marking → correction → handwriting example stored → second page → improved transcription — before investing in the full knowledge-management system.*
