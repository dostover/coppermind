import { NextRequest, NextResponse } from "next/server";
import { notesRepo, notePagesRepo, tagsRepo, noteTagsRepo, foldersRepo } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import {
  recordHandwritingCorrection,
  updateHandwritingProfile,
} from "@/lib/handwritingProfile";
import { isStructureType, type StructureType, type TranscriptSegment } from "@/lib/ai/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  return NextResponse.json(note);
}

interface PatchBody {
  title?: string | null;
  // Multi-page notes: segments are now grouped by page, since each page is
  // its own note_pages row with its own segments_current. A page with no
  // ready content yet (still transcribing, or errored) simply isn't
  // included - the review screen never sends segments for a page it hasn't
  // rendered an editor for.
  // structureType/startsNewBlock are optional so an older client that hasn't
  // loaded this change yet still works - the mapping below falls back to
  // whatever the segment already had rather than clearing it. A segment id
  // with no counterpart in either segments_ai or segments_current is a
  // brand-new segment created client-side by splitting an existing one (see
  // ReviewEditor.tsx's handleSplitSegment); one that previously existed but
  // is simply missing from this list was merged away (handleMergeSegmentBackward)
  // and is deleted by omission - see the per-segment loop below for both.
  pages: {
    pageId: string;
    segments: { id: string; text: string; structureType?: StructureType; startsNewBlock?: boolean }[];
  }[];
  // Both optional and independently applied: omitting a field leaves that
  // note property untouched, so callers that only save segments/title (if
  // any remain) don't accidentally clear folder/tags.
  folderId?: string | null;
  tags?: string[];
}

// Hand-rolled validation rather than a schema library (none is a dependency
// here) - strict about shape (wrong types/missing required fields => 400,
// nothing is silently coerced) but permissive about which optional fields
// are present, matching PatchBody's own comment about older clients. This
// exists because the route used to trust the parsed JSON's shape completely:
// a non-array `segments` (e.g. a string - `for...of` happily iterates its
// characters) silently replaced a page's whole transcription with garbage,
// and a missing `pages` or a non-string `text` threw an uncaught exception
// (bare 500, no error body) instead of a clean 400. Every check below
// verifies the thing that a real bug report showed being trusted blindly.
// Neither cap is enforced by the DB (tags.name/notes.title are plain TEXT
// columns, unbounded), so nothing stopped a pathological client from saving
// a many-kilobyte "tag" or note title. Generous enough for any real use.
const MAX_TAG_NAME_LENGTH = 50;
const MAX_TITLE_LENGTH = 300;

function validatePatchBody(raw: unknown): { error: string } | { body: PatchBody } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "Request body must be a JSON object." };
  }
  const body = raw as Record<string, unknown>;

  if (body.title !== undefined && body.title !== null && typeof body.title !== "string") {
    return { error: "title must be a string or null." };
  }

  if (!Array.isArray(body.pages)) {
    return { error: "pages must be an array." };
  }
  for (const pageBody of body.pages) {
    if (typeof pageBody !== "object" || pageBody === null) {
      return { error: "Each entry in pages must be an object." };
    }
    const p = pageBody as Record<string, unknown>;
    if (typeof p.pageId !== "string") {
      return { error: "Each page entry needs a string pageId." };
    }
    if (!Array.isArray(p.segments)) {
      return { error: `pages[pageId=${p.pageId}].segments must be an array.` };
    }
    for (const seg of p.segments) {
      if (typeof seg !== "object" || seg === null) {
        return { error: "Each segment must be an object." };
      }
      const s = seg as Record<string, unknown>;
      if (typeof s.id !== "string" || typeof s.text !== "string") {
        return { error: "Each segment needs a string id and a string text." };
      }
      if (s.structureType !== undefined && !isStructureType(s.structureType)) {
        return { error: `Invalid structureType: ${String(s.structureType)}.` };
      }
      if (s.startsNewBlock !== undefined && typeof s.startsNewBlock !== "boolean") {
        return { error: "startsNewBlock must be a boolean." };
      }
    }
  }

  if (body.folderId !== undefined && body.folderId !== null && typeof body.folderId !== "string") {
    return { error: "folderId must be a string or null." };
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== "string")) {
      return { error: "tags must be an array of strings." };
    }
    if (body.tags.some((t) => t.trim().length > MAX_TAG_NAME_LENGTH)) {
      return { error: `Tag names must be ${MAX_TAG_NAME_LENGTH} characters or fewer.` };
    }
  }

  if (typeof body.title === "string" && body.title.trim().length > MAX_TITLE_LENGTH) {
    return { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` };
  }

  return { body: body as unknown as PatchBody };
}

// Save flow (FR-5.4/FR-5.6/FR-6.1): saves even if some segments are still
// flagged (partial review is allowed), persists the corrected transcription
// as authoritative without discarding the original AI output, and diffs
// every changed segment against the AI's original text to record
// HandwritingExample rows automatically - no separate "teach AI" step. Runs
// across every page in the same save, since a multi-page note is reviewed
// and saved as one logical unit even though its content is split across
// several note_pages rows.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  // A stale editor tab opened before this note was moved to Trash could
  // otherwise still write to it - the UI itself blocks this (a trashed note
  // renders the restore/purge card, never ReviewEditor - see
  // app/notes/[id]/page.tsx), but the API had no equivalent guard.
  if (note.deleted_at) {
    return NextResponse.json({ error: "This note is in Trash - restore it before editing." }, { status: 409 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validated = validatePatchBody(rawBody);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const body = validated.body;

  // folderId is validated against the folders table up front, before any
  // write happens below - setFolder's UPDATE would otherwise throw a raw
  // FOREIGN KEY constraint violation (folders.id, PRAGMA foreign_keys=ON)
  // for a stale/deleted folder id, which surfaced as a bare 500 *after*
  // title/segment changes earlier in this same handler had already been
  // written - a partial save the client had no way to detect (the 500's
  // empty body itself failed to parse as JSON client-side). Checking this
  // before any repo call keeps the save all-or-nothing.
  if (body.folderId !== undefined && body.folderId !== null && !foldersRepo.getById(body.folderId)) {
    return NextResponse.json({ error: "That folder no longer exists." }, { status: 400 });
  }

  const pagesById = new Map(note.pages.map((p) => [p.id, p]));
  const provider = getAIProvider();
  const now = new Date().toISOString();

  let anyCorrectionRecorded = false;

  for (const pageBody of body.pages) {
    const page = pagesById.get(pageBody.pageId);
    if (!page) continue; // ignore unknown page ids rather than failing the whole save
    // A page whose transcription has been deleted (see delete-transcription/
    // route.ts) has both segments_ai and segments_current wiped to '[]' -
    // any segment ids a client sends for it are necessarily stale (from
    // before the deletion, e.g. a save request already in flight, or a
    // second tab that never reloaded). Processing them would silently
    // resurrect the "deleted" transcription instead of leaving it gone.
    if (page.transcriptionRemoved) continue;

    const aiById = new Map(page.segmentsAi.map((s) => [s.id, s]));
    // Last-saved state, so re-opening and re-saving an already-reviewed note
    // (the "Edit Note" flow) only evaluates/records segments actually
    // touched in *this* save - not every segment that still differs from
    // the original AI guess, which would otherwise re-record the same
    // correction and re-call the AI evaluator on every single save.
    const currentById = new Map(page.segmentsCurrent.map((s) => [s.id, s]));

    const updatedSegments: TranscriptSegment[] = [];
    for (const edited of pageBody.segments) {
      const original = aiById.get(edited.id);
      const previous = currentById.get(edited.id);

      if (original) {
        // A segment the AI actually produced (possibly already edited or
        // reclassified on an earlier save) - falls back to the last-saved
        // value, not the AI's original guess, for anything this save didn't
        // send: a structureType/startsNewBlock the user changed on an
        // earlier save must stick across every subsequent save, the same as
        // an edited text value already does. Only an old client that never
        // sends a field at all falls through this far.
        const base = previous ?? original;
        const changedFromOriginalAi = edited.text !== original.text;
        const changedThisSave = edited.text !== base.text;
        updatedSegments.push({
          ...original,
          text: edited.text,
          structureType: edited.structureType ?? base.structureType,
          startsNewBlock: edited.startsNewBlock ?? base.startsNewBlock,
          // The flag clears the moment the user edits that span away from
          // the AI's original guess (Phase 3 UX §5); an untouched flagged
          // span stays flagged post-save (FR-5.4).
          reviewRequired: changedFromOriginalAi ? false : original.reviewRequired,
        });

        if (changedThisSave && changedFromOriginalAi) {
          const evaluation = await provider.evaluateHandwritingCorrection({
            aiText: original.text,
            correctedText: edited.text,
            originalConfidence: original.confidence,
          });
          recordHandwritingCorrection({
            noteId: id,
            segmentId: original.id,
            aiText: original.text,
            correctedText: edited.text,
            originalConfidence: original.confidence,
            evaluation,
          });
          anyCorrectionRecorded = true;
        }
      } else {
        // No AI baseline at all - a segment created client-side by
        // splitting an existing one in two (see ReviewEditor.tsx's
        // handleSplitSegment). There's no "AI guess" to diff a handwriting
        // correction against, so this never touches the learning pipeline -
        // it's a structural edit, not new handwriting content. `previous`
        // carries its other fields forward once it's been saved at least
        // once; the very first save of a brand-new segment (still only in
        // this request, never persisted before) falls back to fixed
        // defaults instead - full confidence and no flags, since a manually
        // split segment needs no review and was never crossed out or
        // AI-transcribed on its own.
        const base: TranscriptSegment =
          previous ?? {
            id: edited.id,
            text: edited.text,
            structureType: "paragraph",
            startsNewBlock: false,
            crossedOut: false,
            emphasis: "none",
            confidence: 1,
            reviewRequired: false,
          };
        updatedSegments.push({
          ...base,
          text: edited.text,
          structureType: edited.structureType ?? base.structureType,
          startsNewBlock: edited.startsNewBlock ?? base.startsNewBlock,
        });
      }
    }

    if (updatedSegments.length > 0) {
      notePagesRepo.setSegments(page.id, updatedSegments, now);
    }
  }

  if (anyCorrectionRecorded) {
    updateHandwritingProfile();
  }

  const title = body.title?.trim() || null;
  notesRepo.setReviewed(id, title, now, title !== note.title);

  if (body.folderId !== undefined) {
    notesRepo.setFolder(id, body.folderId, now);
  }

  // The review screen always sends its complete current tag list (same
  // pattern as segments_current) - saved here as source: 'user' regardless
  // of whether a given tag started as an AI suggestion, since the act of
  // saving from the review screen is the user's confirmation of the final
  // set (AC-9: removed AI tags must not silently reappear; kept/edited ones
  // are now user-owned).
  if (body.tags !== undefined) {
    const resolved = body.tags
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => tagsRepo.findOrCreate(name, now));
    noteTagsRepo.setForNote(
      id,
      resolved.map((t) => ({ tagId: t.id, source: "user" as const, confidence: null })),
      now
    );
  }

  return NextResponse.json(notesRepo.getById(id));
}

// "Delete note" from the review screen now soft-deletes (03-ux-screens.md's
// Trash-with-a-grace-period, rather than one irreversible action) - nothing
// on disk or in the db is actually touched here, just deleted_at. Permanent
// removal is the separate /purge route, only reachable from Trash.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  notesRepo.softDelete(id, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
