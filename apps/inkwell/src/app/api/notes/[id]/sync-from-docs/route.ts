import { NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { enqueueIndexNote } from "@/lib/jobs";
import { syncRevisedFromGoogleDoc } from "@/lib/google/docsSync";
import { GoogleNotConnectedError } from "@/lib/google/oauth";

// "Check Google Docs now" on the review screen: reads the note's linked Doc
// right away instead of waiting for the next background check (jobs.ts),
// and returns the note's revised text as it now stands. One Docs API read,
// so synchronous like export-to-docs.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!notesRepo.getById(id)) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  try {
    const { result, needsReindex } = await syncRevisedFromGoogleDoc(id);
    if (needsReindex) enqueueIndexNote(id);
    const note = notesRepo.getById(id);
    return NextResponse.json({
      result,
      revisedText: note?.revised_text ?? null,
      revisedSyncedAt: note?.revised_synced_at ?? null,
    });
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Reading the Google Doc failed:", err);
    const message = err instanceof Error ? err.message : "Couldn't read the Google Doc.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
