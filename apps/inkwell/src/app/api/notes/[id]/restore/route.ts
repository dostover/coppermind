import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";

// Undo for the soft-delete in .. /route.ts's DELETE handler - only reachable
// from the Trash view. Clears deleted_at; everything else about the note
// (pages, tags, folder) was left untouched by the soft delete, so there's
// nothing else to restore.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  notesRepo.restore(id, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
