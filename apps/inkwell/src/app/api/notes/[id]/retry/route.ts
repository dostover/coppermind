import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { enqueuePageTranscribeJob } from "@/lib/jobs";

interface RetryBody {
  // Optional: retry just this one page. Omitted (or a note with no body at
  // all) retries every page currently in 'error' - the old "Retry" button
  // behavior, now covering all failed pages of a multi-page note at once.
  pageId?: string;
}

// Retries only the failed transcription stage(s), without re-uploading the
// original image(s) (FR-3.8/FR-13.2) - the image(s) saved during upload are
// reused. As with upload, this enqueues job(s) and returns immediately
// instead of awaiting the AI call itself - see src/lib/jobs.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  let body: RetryBody = {};
  try {
    body = (await req.json()) as RetryBody;
  } catch {
    // No JSON body sent - fine, defaults to "retry every failed page".
  }

  const targets = body.pageId
    ? note.pages.filter((p) => p.id === body.pageId)
    : note.pages.filter((p) => p.status === "error");

  if (targets.length === 0) {
    return NextResponse.json({ error: "No failed page to retry." }, { status: 400 });
  }

  for (const page of targets) {
    enqueuePageTranscribeJob(page.id, id);
  }

  return NextResponse.json(notesRepo.getById(id));
}
