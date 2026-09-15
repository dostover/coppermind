import { NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { exportNoteToGoogleDoc, NothingToExportError } from "@/lib/google/docsExport";
import { GoogleNotConnectedError } from "@/lib/google/oauth";

// Exports (or re-exports, updating the same Doc in place) one note to
// Google Docs. Synchronous, unlike upload/retry - unlike a Claude call this
// is a couple of quick Docs API requests, not a multi-second AI operation,
// so there's no need for the processing_jobs queue here.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  try {
    const { url } = await exportNoteToGoogleDoc(note);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof NothingToExportError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Google Docs export failed:", err);
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
