import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";

// Naive substring search (FR-10.1) over saved notes - enough to confirm
// notes are durably saved and retrievable. Hybrid/semantic search (FR-10.3,
// FR-10.6) is deferred per claude/08-walking-skeleton-scope.md.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  // "folder" query param: absent = no filter, "" (or "none") = unfiled notes
  // only, "trash" = the Trash view (see library/page.tsx), otherwise a
  // folder id.
  const folderParam = req.nextUrl.searchParams.get("folder");
  if (folderParam === "trash") {
    return NextResponse.json({ notes: notesRepo.listAll(q, undefined, "trash") });
  }
  const folderId =
    folderParam === null ? undefined : folderParam === "" || folderParam === "none" ? null : folderParam;
  const notes = notesRepo.listAll(q, folderId);
  return NextResponse.json({ notes });
}
