# Inkwell — Phase 3: UX

**Spec-DD Phase:** 3 of 7 (UX)
**Status:** Draft for review
**Date:** 2026-08-13

Nine primary screens, per §41 Phase 3. Design priority order follows §35: accurate transcription → easy correction → fast capture → reliable storage → useful search → useful organization → AI insights. The critical UX principle (§36) governs every screen involving AI output: the user should never wonder what the AI thinks it saw — the answer is always visibly on screen, distinct from what it's unsure about.

---

## 1. Sign In

**Purpose:** authenticate, get to the library as fast as possible.

**Layout:** minimal centered form — email/password (or OAuth button), "create account" toggle. No marketing chrome; this is a utility, not a landing page.

**Critical interactions:**
- New user → create account → lands directly in an empty Library with a prominent "Capture your first note" call to action (not a blank, unexplained grid).
- Returning user → session persists across devices (FR-1.3); signing in on a second device shows the same library.
- Failed auth → inline error, no page reload, focus returns to the offending field.

---

## 2. Library

**Purpose:** the home screen — browse, filter, and enter every note.

**Layout:** left/side nav (All Notes, Recent, Favorites, Folders tree, Tags, Trash — §23), main area with grid/list toggle, sort control (date, title, relevance), search bar always visible at the top, a persistent "+" capture action (floating button on mobile, toolbar button on desktop).

**Critical interactions:**
- Each note card shows: title, thumbnail of first page (or a text snippet if no image), folder chip, up to ~3 tags, date, and a small processing-status indicator when not yet `ready` (§29) — so in-flight notes are visible, not hidden until done (FR-2.5, FR-17.1).
- Filtering by folder or tag narrows the grid live; multiple tag filters combine (AND by default).
- Grid ↔ list view toggle persists as a user preference.
- Trash holds deleted notes for a grace period before permanent deletion (soft delete), separate from the explicit "delete original image" action.
- Tapping a processing note opens the Processing screen (§4 below) instead of Note Detail, if not yet `ready_for_review`.

---

## 3. Capture / Upload

**Purpose:** get a handwritten page from paper (or an existing file) into the pipeline as fast as possible — this is the #3 UX priority (§35).

**Layout (mobile-first):** full-screen camera viewfinder is the default entry point on mobile when the browser supports `getUserMedia`; a bottom action bar offers Take Photo / Choose from Library / Upload PDF. Desktop opens directly to a drag-and-drop + file-picker panel.

**Critical interactions:**
- After each shot/selection, the user lands on a **review filmstrip**: thumbnails of all pages captured so far, each removable/retakeable, with a running "Page N" label and a drag-to-reorder gesture (FR-2.3).
- "Add another page" keeps the camera/picker open in a loop so a multi-page document can be captured in one continuous flow (FR-2.4) — this is the single most important interaction for real-world use (notebooks are rarely one page).
- A single "Save as one note" confirmation groups all reviewed pages into one logical multi-page note and immediately starts upload; the screen transitions straight to the Processing screen (or back to Library with the new note showing an in-progress state) — no blocking spinner (FR-2.5, FR-17.1).
- PDF upload skips the camera flow and goes straight to page identification.
- Poor capture conditions (very dark, extreme blur) get a lightweight on-device heads-up ("This looks blurry — retake?") before upload, without hard-blocking the user from proceeding anyway.

---

## 4. Processing

**Purpose:** show that work is happening, without forcing the user to wait synchronously (§28–29, FR-17.2).

**Layout:** a simple vertical stage tracker (Uploaded → Preprocessing → Transcribing → Analyzing confidence → Ready for review), with the current stage highlighted. A "you can leave this screen" hint plus a Library link, since notes continue processing in the background.

**Critical interactions:**
- Live status updates (poll or push) advance the tracker without a manual refresh.
- On reaching `ready_for_review`, the screen auto-offers "Review now" (primary) / "Later, back to Library" (secondary) — never forces immediate review.
- On error, the tracker shows the failed stage in place with a plain-language message and a Retry action that does not discard the upload (FR-13.2).

---

## 5. Transcription Review

**Purpose:** the most important screen in the product (§9) — proofread, not fight, the AI (§36).

**Layout — desktop:** split-screen, original page image (left, pannable/zoomable) and editable transcription (right), synced scroll where feasible. **Layout — mobile:** a toggle tab (Original / Transcription) or a stacked layout with the image collapsible above the editable text.

**Critical interactions:**
- Review-required spans render with a clear, consistent visual treatment (e.g., underline + soft highlight) distinct from normal text — never a numeric confidence score inline (FR-4.7, FR-5.2).
- Tapping/clicking a flagged span opens an inline correction affordance (edit in place) — the flag clears the moment the user edits that span, giving immediate positive feedback that the correction registered.
- The transcription text area supports full free-form editing (not just accept/reject of flagged spans) — insertions, deletions, paragraph breaks, reformatting (FR-5.3).
- Where positional metadata exists, selecting transcription text scrolls/highlights the corresponding original-image region (FR-5.5, best-effort — degrades gracefully to no-op if unavailable, never an error state).
- A persistent "Save" action is available at all times and explicitly does **not** require every flagged span to be resolved (FR-5.4) — a small counter ("3 items still flagged") is informational, not a blocker.
- On save, a brief, non-intrusive confirmation appears ("Saved — 4 corrections recorded") acknowledging that corrections feed the handwriting profile, without exposing internal learning mechanics as a separate step the user must trigger (FR-6.1).
- Saving transitions the note into the `analyzing` pipeline stage; the user can navigate to Library or stay to watch, mirroring the Processing screen's non-blocking pattern.

---

## 6. Note Detail

**Purpose:** the permanent home of a note after processing — read, re-edit, organize, verify against the source (§24).

**Layout:** header block (title — inline-editable, folder breadcrumb/chip, tag chips, date, action menu); main content area (adaptive summary per note type, corrected transcription, related notes list); collapsible/tabbed "Original" section showing the source image(s) when still in retention.

**Critical interactions:**
- Title is inline-editable directly in the header; AI-suggested titles are pre-filled but never regenerate over a user's saved edit (FR-7.7, FR-15.1).
- Summary fields render per the note's type-specific template (§16 Adaptive Summarization is a content generation rule, not a UI rule — the UI just needs to render whatever field set that note's type returned) and are directly editable inline.
- Tags: chip row with an inline add/remove control; typing a new tag shows autocomplete against the user's existing tag vocabulary first (supporting FR-7.6 at the UI layer).
- "Move" opens a folder picker (tree with search) — moving is always a single explicit user action, never automatic.
- "Edit" reopens the Transcription Review screen for this note, pre-populated with the current corrected text (not a fresh AI re-transcription) — see next bullet for the distinct "Reprocess" action.
- "Reprocess" is a separate, clearly-labeled action (e.g., under an overflow menu, with a confirmation) that re-runs AI transcription from the original image — since this could overwrite manual corrections, it warns the user and requires confirmation before replacing the current transcription (FR-15.2).
- "Delete" offers two distinct choices, not one destructive button: "Delete original image only" vs. "Delete entire note" — mirroring FR-1.4/FR-1.5's requirement that these be independent actions.
- Related notes render as a simple list (title, relationship label like "mentions Rilldale," date) each linking directly to that note's detail page (FR-9.2).
- If the original has been removed by retention policy, the Original section shows a clear "Original no longer available (removed per your retention setting on [date])" state rather than a broken image or blank area (§25/FR-12.4).

---

## 7. Search

**Purpose:** core capability, not a modal afterthought (§20).

**Layout:** a single search surface reachable from anywhere (persistent bar in Library, or a dedicated full-screen search on mobile) that accepts both short keyword queries and full natural-language questions without the user needing to pick a "mode" in advance.

**Critical interactions:**
- As the user types, lightweight instant keyword/tag matches can appear (optional progressive enhancement); full hybrid search results load on submit.
- Each result row shows title, snippet with the matching text highlighted, folder, tags, date, and a relevance affordance (e.g., subtle ranking order — no raw score number) (FR-10.7).
- When the query reads as a question, an "Answer" panel appears above the result list: a synthesized response with inline citations/links back to the specific notes it drew from; the underlying note list is still shown below — the answer never replaces or hides the source notes (FR-10.4, §22, FR-10.7).
- Empty/low-confidence results state suggests trying a different phrasing or browsing folders/tags instead of a dead end.
- Filters (folder, tag, date range, note type) are available as a refinement panel alongside results, not required up front.

---

## 8. Folder / Tag Management

**Purpose:** let the user own their organizational system (§4.4, §18).

**Layout:** accessible from the Library sidebar ("Manage folders," "Manage tags") — a tree editor for folders (create, rename, nest, delete-with-reassignment-prompt) and a flat searchable list for tags (rename, merge, delete).

**Critical interactions:**
- Creating a folder is available at any time, including inline from the "Move" picker on Note Detail (no need to leave the note to make a new folder first) (FR-8.1).
- Deleting a non-empty folder prompts: move its notes to another folder, or leave them unfiled — never silently deletes notes.
- Tag rename propagates everywhere that tag is used; tag merge (e.g., user merges an AI-created near-duplicate into their canonical tag) updates all affected notes and reinforces the tag-preference signal used by FR-7.6 going forward.
- Tags/folders created or edited here are immediately reflected in the Library filters and Note Detail chip pickers.

---

## 9. Settings

**Purpose:** account, privacy, and configuration controls.

**Layout:** simple sectioned list — Account, Privacy & Data, Processing preferences, About.

**Critical interactions:**
- Account: change email/password, sign out, **delete account** (clearly separated, requires typed confirmation, explains cascading deletion per FR-1.6).
- Privacy & Data: configure original-image retention policy (§25/FR-12.2), trigger data export (FR-1.7), view/delete individual originals in bulk if desired.
- Processing preferences: any user-facing knobs the app chooses to expose (e.g., confidence-threshold sensitivity, if surfaced beyond the app-level default per A2 in Phase 1) — optional for MVP.
- About: plain-language explanation of what data is sent to the AI provider and why (supports the transparency spirit of §26 even though it's not a strict functional requirement).

---

## Cross-Screen UX Notes

- **Processing status is always visible from Library**, never only discoverable by opening a note — this is what makes the async pipeline (§28) feel trustworthy rather than opaque.
- **Every AI-generated field, everywhere, uses the same "AI suggested this, here's how to change it" visual language** (subtle badge or icon consistent across title, summary, tags, folder suggestion) so users learn one pattern once rather than relearning it per screen (§32, §36).
- **Destructive/irreversible actions** (delete note, delete original, delete account) always require an explicit confirm step and are visually distinguished (color, placement) from routine actions (move, edit, retry).

---

*Next: Phase 4 — Data Model.*
