import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";

// Naive substring search (FR-10.1) over saved notes - enough to confirm
// notes are durably saved and retrievable. Hybrid/semantic search (FR-10.3,
// FR-10.6) is deferred per claude/08-walking-skeleton-scope.md.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const notes = notesRepo.listAll(q);
  return NextResponse.json({ notes });
}
