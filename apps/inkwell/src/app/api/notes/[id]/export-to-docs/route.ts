import { NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { exportNoteToGoogleDoc, GoogleDocChangedError, NothingToExportError } from "@/lib/google/docsExport";
import { GoogleNotConnectedError } from "@/lib/google/oauth";

// Exports (or re-exports, updating the same Doc in place) one note to
// Google Docs. Synchronous, unlike upload/retry - unlike a Claude call this
// is a couple of quick Docs API requests, not a multi-second AI operation,
// so there's no need for the processing_jobs queue here.
//
// Body (optional JSON): { asCopy: true } writes the draft into a new Doc
// without relinking the note - the way out when the linked Doc was edited
// in Google Docs and a re-export is refused (409, code "doc_changed").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  let asCopy = false;
  try {
    const body = (await req.json()) as { asCopy?: unknown };
    asCopy = body?.asCopy === true;
  } catch {
    // No body (or not JSON) - a plain export.
  }

  try {
    const { url, linked } = await exportNoteToGoogleDoc(note, { asCopy });
    return NextResponse.json({ url, linked });
  } catch (err) {
    if (err instanceof GoogleDocChangedError) {
      return NextResponse.json({ error: err.message, code: "doc_changed", url: err.url }, { status: 409 });
    }
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
