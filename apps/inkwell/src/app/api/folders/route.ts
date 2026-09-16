import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { foldersRepo } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ folders: foldersRepo.listAll() });
}

const MAX_FOLDER_NAME_LENGTH = 100;

// Manual-only for this phase (no AI folder suggestion) - see
// claude/09-walking-skeleton-architecture.md's AI-scope decision for the
// tags/folders feature.
export async function POST(req: NextRequest) {
  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
  }
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }
  if (foldersRepo.findByNormalizedName(name)) {
    return NextResponse.json({ error: `A folder named "${name}" already exists.` }, { status: 409 });
  }

  const id = randomUUID();
  foldersRepo.create({ id, name, createdAt: new Date().toISOString() });
  return NextResponse.json(foldersRepo.getById(id), { status: 201 });
}
