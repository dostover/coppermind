import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { enqueueTranscribeJob } from "@/lib/jobs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Async processing (per claude/09-walking-skeleton-architecture.md's
// "Synchronous upload" note, superseding the walking-skeleton's original
// deliberate deviation from FR-2.5/FR-17.1): upload only saves the file and
// enqueues a processing_jobs row, then returns immediately - it never
// itself awaits the AI call. The actual transcribe+tag-suggestion work now
// lives in src/lib/jobs.ts, run by the in-process job runner started from
// src/instrumentation.ts. The note page polls GET /api/notes/[id] and shows
// a "still processing" state until the job completes.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Use JPEG, PNG, or WebP.` },
      { status: 400 }
    );
  }

  const id = randomUUID();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const relativePath = `uploads/${id}.${ext}`;
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  const now = new Date().toISOString();
  notesRepo.create({ id, title: null, imagePath: relativePath, createdAt: now });

  // Failure here does not lose the uploaded original (FR-3.8/FR-13.2) - the
  // image and note row already exist; a job that later fails leaves the
  // note in a recoverable 'error' state (see jobs.ts's runOneJob) with the
  // existing Retry action still available.
  enqueueTranscribeJob(id);

  return NextResponse.json({ id }, { status: 201 });
}
