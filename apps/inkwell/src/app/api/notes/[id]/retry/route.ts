import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { enqueueTranscribeJob } from "@/lib/jobs";

// Retries only the failed transcription stage, without re-uploading the
// original image (FR-3.8/FR-13.2) - the image saved during upload is
// reused. As with upload, this now enqueues a job and returns immediately
// instead of awaiting the AI call itself - see src/lib/jobs.ts.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  enqueueTranscribeJob(id);

  return NextResponse.json(notesRepo.getById(id));
}
