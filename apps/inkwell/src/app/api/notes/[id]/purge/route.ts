import { unlink } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";

// The actual permanent deletion, only reachable from Trash - this is the
// logic that used to live directly on DELETE /api/notes/[id] before that
// became a soft delete. Removes the db row, its pages (ON DELETE CASCADE on
// note_pages.note_id) and handwriting_examples (ON DELETE CASCADE), and every
// page's uploaded image file. Callers should confirm this is what the user
// wants before calling it - unlike the soft delete, there's no undo.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  const pages = note.pages;
  notesRepo.delete(id);

  for (const page of pages) {
    if (page.imageRemoved) continue; // already deleted separately, nothing left to unlink
    try {
      const absolutePath = path.join(process.cwd(), "public", page.image_path);
      await unlink(absolutePath);
    } catch {
      // Best-effort - the note/page records are already gone either way, and
      // a missing/already-removed file shouldn't block the delete succeeding.
    }
  }

  return NextResponse.json({ ok: true });
}
