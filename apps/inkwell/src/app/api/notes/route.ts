import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";

// Note listing with an optional plain substring filter (FR-10.1). Ranked
// hybrid search - keyword + meaning - lives at GET /api/search (see
// src/lib/search.ts); this stays a simple filtered list, e.g. for Trash.
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
