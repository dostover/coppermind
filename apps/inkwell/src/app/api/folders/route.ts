import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { foldersRepo } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ folders: foldersRepo.listAll() });
}

// Manual-only for this phase (no AI folder suggestion) - see
// claude/09-walking-skeleton-architecture.md's AI-scope decision for the
// tags/folders feature.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
  }

  const id = randomUUID();
  foldersRepo.create({ id, name, createdAt: new Date().toISOString() });
  return NextResponse.json(foldersRepo.getById(id), { status: 201 });
}
