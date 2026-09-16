import { unlink } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notePagesRepo } from "@/lib/db";

// "Delete original image only" (03-ux-screens.md §6) - independent of
// deleting the whole note. Removes just this page's source photo from disk
// and flags it so the review screen shows a placeholder instead; the
// transcription (segments_current) is left completely alone. Irreversible
// (unlike the note-level soft delete) since the file itself is actually
// gone, so the client confirms before calling this.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const { id, pageId } = await params;
  const page = notePagesRepo.getById(pageId);
  if (!page || page.note_id !== id) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }
  if (page.imageRemoved) return NextResponse.json({ ok: true }); // already gone, idempotent

  try {
    const absolutePath = path.join(process.cwd(), "public", page.image_path);
    await unlink(absolutePath);
  } catch {
    // Missing/already-removed file shouldn't block flagging it as removed.
  }

  notePagesRepo.setImageRemoved(pageId, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
