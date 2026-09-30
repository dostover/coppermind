import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/search";

// Hybrid Library search (exact text + keyword + meaning, rank-fused) - see
// src/lib/search.ts. `folder` narrows it the same way GET /api/notes does:
// absent = all notes, "" or "none" = unfiled, otherwise a folder id.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });
  const folderParam = req.nextUrl.searchParams.get("folder");
  const folderId =
    folderParam === null ? undefined : folderParam === "" || folderParam === "none" ? null : folderParam;

  const hits = await searchNotes(q, folderId);
  return NextResponse.json({
    results: hits.map((h) => ({
      noteId: h.note.id,
      title: h.note.title,
      snippet: h.snippet,
      matchedBy: h.matchedBy,
      score: h.score,
      createdAt: h.note.created_at,
      tags: h.note.tags.map((t) => t.name),
    })),
  });
}
