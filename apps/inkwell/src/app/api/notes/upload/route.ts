import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo, notePagesRepo } from "@/lib/db";
import { enqueuePageTranscribeJob } from "@/lib/jobs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Async processing (per claude/09-walking-skeleton-architecture.md's
// "Synchronous upload" note, superseding the walking-skeleton's original
// deliberate deviation from FR-2.5/FR-17.1): upload only saves the file(s)
// and enqueues a processing_jobs row per page, then returns immediately - it
// never itself awaits any AI call. The actual transcribe+tag-suggestion work
// now lives in src/lib/jobs.ts, run by the in-process job runner started
// from src/instrumentation.ts. The note page polls GET /api/notes/[id] and
// shows a "still processing" state (per page) until each page's job completes.
//
// Multi-page notes (FR-2.4): one upload can carry several page images under
// the repeated "images" field, in the order the client sent them - that
// order becomes each page's page_number. All pages are grouped under one
// new note row from the start, matching the spec's "explicitly grouped into
// a single logical multi-page note."
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No image files provided." }, { status: 400 });
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type}". Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }
  }

  const noteId = randomUUID();
  const now = new Date().toISOString();
  notesRepo.create({ id: noteId, title: null, createdAt: now });

  // Failure partway through does not lose already-saved pages or the note
  // itself (FR-3.8/FR-13.2) - each page is its own durable row, and a page
  // whose job later fails leaves that page in a recoverable 'error' state
  // (see jobs.ts's runOneJob) with a per-page Retry action still available.
  const pageIds: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pageId = randomUUID();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const relativePath = `uploads/${pageId}.${ext}`;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, bytes);

    notePagesRepo.create({
      id: pageId,
      noteId,
      pageNumber: i + 1,
      imagePath: relativePath,
      createdAt: now,
    });
    pageIds.push(pageId);
  }

  for (const pageId of pageIds) {
    enqueuePageTranscribeJob(pageId, noteId);
  }

  return NextResponse.json({ id: noteId }, { status: 201 });
}
