import { NextRequest, NextResponse } from "next/server";
import { foldersRepo } from "@/lib/db";

// Deletes the folder; any notes in it are reassigned to "no folder" first
// (foldersRepo.delete), never deleted - 04-data-model.md's cascade notes.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const folder = foldersRepo.getById(id);
  if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });

  foldersRepo.delete(id);
  return NextResponse.json({ ok: true });
}
