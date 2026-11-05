import { NextRequest, NextResponse } from "next/server";
import { notePagesRepo, notesRepo } from "@/lib/db";
import { enqueueIndexNote } from "@/lib/jobs";
import { derivePlaceholderTitle } from "@/lib/titleGen";

// Reorders a note's pages after upload (2026-11-05) - for photos that came
// in out of order. A page's photo and its transcription are one note_pages
// row, so they always move together; nothing is re-transcribed. Body:
// { pageIds: string[] } listing every page of the note exactly once, in the
// new order. Saved immediately (not on the review screen's Save), so
// unsaved text edits on the screen are unaffected either way.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note || note.deleted_at) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const pageIds = (body as { pageIds?: unknown } | null)?.pageIds;
  const existing = new Set(note.pages.map((p) => p.id));
  if (
    !Array.isArray(pageIds) ||
    pageIds.length !== existing.size ||
    new Set(pageIds).size !== pageIds.length ||
    !pageIds.every((pid) => typeof pid === "string" && existing.has(pid))
  ) {
    return NextResponse.json(
      { error: "pageIds must list every page of this note exactly once." },
      { status: 400 }
    );
  }

  // Transcription jobs decide the placeholder title by page_number (see
  // jobs.ts), so pages can't move while any of them is still being worked on.
  if (note.pages.some((p) => p.status === "uploaded" || p.status === "transcribing")) {
    return NextResponse.json(
      { error: "Pages can be reordered once every page has finished processing." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  notePagesRepo.reorder(id, pageIds as string[], now);

  // The automatic title comes from page 1 - follow the new page 1.
  const firstPage = note.pages.find((p) => p.id === pageIds[0]);
  if (note.title_source === "ai" && firstPage?.status === "ready_for_review" && !firstPage.transcriptionRemoved) {
    const placeholder = derivePlaceholderTitle(firstPage.segmentsCurrent);
    if (placeholder) notesRepo.replacePlaceholderTitle(id, placeholder, now);
  }

  // Search results cite page numbers - rebuild this note's index.
  enqueueIndexNote(id);

  const updated = notesRepo.getById(id);
  return NextResponse.json({ title: updated?.title ?? null, titleSource: updated?.title_source ?? "ai" });
}
