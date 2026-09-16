import { NextRequest, NextResponse } from "next/server";
import { notePagesRepo } from "@/lib/db";

// "Delete transcription only" (mirrors delete-image/route.ts) - independent
// of deleting the whole note, and independent of deleting this page's
// image: discards just the transcribed text, so the review screen shows a
// placeholder instead of an empty editor. The photo itself (image_path) is
// left completely alone. Irreversible - notePagesRepo.setTranscriptionRemoved
// clears segments_ai/segments_current in the same call, there's no on-disk
// original to fall back to the way there is for a photo - so the client
// confirms before calling this, same as delete-image.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { id, pageId } = await params;
  const page = notePagesRepo.getById(pageId);
  if (!page || page.note_id !== id) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }
  if (page.transcriptionRemoved) return NextResponse.json({ ok: true }); // already gone, idempotent

  notePagesRepo.setTranscriptionRemoved(pageId, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
