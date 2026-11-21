import { NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { enqueuePageTranscribeJob } from "@/lib/jobs";

// "Turn upright and read again" on a page photographed sideways before
// Inkwell turned photos upright itself (pageOrientation.ts). Queues a fresh
// transcription of the page, which turns the photo upright first. Replaces
// this page's transcription, including any corrections made to it - the
// review screen asks before calling this.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  const page = note.pages.find((p) => p.id === pageId);
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  if (!page.image_path || page.imageRemoved) {
    return NextResponse.json({ error: "This page's photo is gone, so it can't be read again." }, { status: 409 });
  }
  if (page.status === "uploaded" || page.status === "transcribing") {
    return NextResponse.json({ error: "This page is already being read." }, { status: 409 });
  }
  enqueuePageTranscribeJob(pageId, id);
  return NextResponse.json(notesRepo.getById(id));
}
