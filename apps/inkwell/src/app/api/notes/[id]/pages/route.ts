import { NextRequest, NextResponse } from "next/server";
import { notePagesRepo, notesRepo } from "@/lib/db";
import { createPagesForNote, prepareUploadedFiles, validateUploadedFiles } from "@/lib/pageUpload";

// Adds pages to the end of an existing note (2026-11-13) - for a chapter
// written in instalments: upload the pages written so far, start correcting
// them, then add the rest here as they are written. Same multipart body as
// POST /api/notes/upload (repeated "images" fields, JPEG/PNG/WebP/PDF), in
// the order sent. New pages are numbered after the note's current last page
// and go through the normal transcribe job; pages already in the note are
// never re-transcribed and keep their saved text. Returns the new page ids.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  if (note.deleted_at) {
    return NextResponse.json({ error: "This note is in Trash - restore it before adding pages." }, { status: 409 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Send the pages as multipart form data." }, { status: 400 });
  }
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  const invalid = validateUploadedFiles(files);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const prepared = await prepareUploadedFiles(files);
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: 400 });

  // The last page number is read inside createPagesForNote's insert
  // transaction, not here, so two add requests arriving together can't both
  // claim the same page numbers.
  const current = notesRepo.getById(id);
  if (!current || current.deleted_at) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  const now = new Date().toISOString();
  const lastPageNumber = () =>
    notePagesRepo.listForNote(id).reduce((max, p) => Math.max(max, p.page_number), 0);
  let pageIds: string[];
  try {
    pageIds = await createPagesForNote(id, prepared.pages, () => lastPageNumber() + 1, now);
  } catch (err) {
    console.error("Adding pages failed:", err);
    return NextResponse.json({ error: "Couldn't add those pages - nothing was changed. Try again." }, { status: 500 });
  }

  return NextResponse.json({ pageIds }, { status: 201 });
}
