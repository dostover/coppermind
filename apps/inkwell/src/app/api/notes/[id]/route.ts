import { unlink } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo, tagsRepo, noteTagsRepo } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import {
  recordHandwritingCorrection,
  updateHandwritingProfile,
} from "@/lib/handwritingProfile";
import type { TranscriptSegment } from "@/lib/ai/types";

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
  segments: { id: string; text: string }[];
  // Both optional and independently applied: omitting a field leaves that
  // note property untouched, so callers that only save segments/title (if
  // any remain) don't accidentally clear folder/tags.
  folderId?: string | null;
  tags?: string[];
}

// Save flow (FR-5.4/FR-5.6/FR-6.1): saves even if some segments are still
// flagged (partial review is allowed), persists the corrected transcription
// as authoritative without discarding the original AI output, and diffs
// every changed segment against the AI's original text to record
// HandwritingExample rows automatically - no separate "teach AI" step.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  const body = (await req.json()) as PatchBody;
  const aiById = new Map(note.segmentsAi.map((s) => [s.id, s]));
  // Last-saved state, so re-opening and re-saving an already-reviewed note
  // (the "Edit Note" flow) only evaluates/records segments actually touched
  // in *this* save - not every segment that still differs from the original
  // AI guess, which would otherwise re-record the same correction and re-call
  // the AI evaluator on every single save of an already-corrected note.
  const currentById = new Map(note.segmentsCurrent.map((s) => [s.id, s]));
  const provider = getAIProvider();

  const updatedSegments: TranscriptSegment[] = [];
  let anyCorrectionRecorded = false;

  for (const edited of body.segments) {
    const original = aiById.get(edited.id);
    if (!original) continue; // ignore unknown segment ids rather than failing the whole save
    const previous = currentById.get(edited.id) ?? original;

    const changedFromOriginalAi = edited.text !== original.text;
    const changedThisSave = edited.text !== previous.text;
    updatedSegments.push({
      ...original,
      text: edited.text,
      // The flag clears the moment the user edits that span away from the
      // AI's original guess (Phase 3 UX §5); an untouched flagged span stays
      // flagged post-save (FR-5.4).
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
  }

  if (anyCorrectionRecorded) {
    updateHandwritingProfile();
  }

  const title = body.title?.trim() || null;
  notesRepo.setReviewed(id, updatedSegments, title, new Date().toISOString());

  if (body.folderId !== undefined) {
    notesRepo.setFolder(id, body.folderId, new Date().toISOString());
  }

  // The review screen always sends its complete current tag list (same
  // pattern as segments_current) - saved here as source: 'user' regardless
  // of whether a given tag started as an AI suggestion, since the act of
  // saving from the review screen is the user's confirmation of the final
  // set (AC-9: removed AI tags must not silently reappear; kept/edited ones
  // are now user-owned).
  if (body.tags !== undefined) {
    const now = new Date().toISOString();
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

// Deletes a note permanently: the db row, its handwriting_examples (via
// ON DELETE CASCADE), and the uploaded image file. There's no separate
// "delete original image only" action in this phase (that's deferred along
// with retention policies - see claude/08-walking-skeleton-scope.md); this
// is the single, permanent "Delete note" action.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  notesRepo.delete(id);

  try {
    const absolutePath = path.join(process.cwd(), "public", note.image_path);
    await unlink(absolutePath);
  } catch {
    // Best-effort - the note record is already gone either way, and a
    // missing/already-removed file shouldn't block the delete succeeding.
  }

  return NextResponse.json({ ok: true });
}
