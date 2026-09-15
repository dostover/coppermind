import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { getHandwritingContext } from "@/lib/handwritingProfile";
import { CONFIDENCE_THRESHOLD } from "@/lib/config";
import { derivePlaceholderTitle } from "@/lib/titleGen";

// Retries only the failed transcription stage, without re-uploading the
// original image (FR-3.8/FR-13.2) - the image saved during upload is reused.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  try {
    const provider = getAIProvider();
    const result = await provider.transcribe({
      imagePath: note.image_path,
      handwritingContext: getHandwritingContext(),
      confidenceThreshold: CONFIDENCE_THRESHOLD,
    });
    notesRepo.setTranscribed(
      id,
      result.segments,
      new Date().toISOString(),
      derivePlaceholderTitle(result.segments)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed.";
    notesRepo.setError(id, message, new Date().toISOString());
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json(notesRepo.getById(id));
}
