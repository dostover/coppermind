import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
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
  const provider = getAIProvider();

  const updatedSegments: TranscriptSegment[] = [];
  let anyCorrectionRecorded = false;

  for (const edited of body.segments) {
    const original = aiById.get(edited.id);
    if (!original) continue; // ignore unknown segment ids rather than failing the whole save

    const changed = edited.text !== original.text;
    updatedSegments.push({
      ...original,
      text: edited.text,
      // The flag clears the moment the user edits that span (Phase 3 UX §5);
      // an untouched flagged span stays flagged post-save (FR-5.4).
      reviewRequired: changed ? false : original.reviewRequired,
    });

    if (changed) {
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

  return NextResponse.json(notesRepo.getById(id));
}
