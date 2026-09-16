import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo, notePagesRepo } from "@/lib/db";
import { enqueueNoteTranscribeJob } from "@/lib/jobs";
import { PdfTooLargeError, rasterizePdfPages } from "@/lib/pdfPrep";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

// One prepared page ready to be written to disk - either an uploaded image
// as-is, or one page rasterized out of an uploaded PDF (pdfPrep.ts). Both
// look identical from here on: a JPEG/PNG/WebP buffer with an extension.
// Flattening PDFs into this shape before any db row is created means a
// note's pages are still exactly "one imagePath per note_pages row" -
// nothing downstream (transcription, gridOverlay, the review UI) needs to
// know a page came from a PDF rather than a photo.
interface PreparedPage {
  bytes: Buffer;
  ext: "jpg" | "png" | "webp";
}

async function preparePages(file: File): Promise<PreparedPage[]> {
  const bytes = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    // Rasterize (and validate - page count, corruption, password
    // protection) up front, before the note/any page rows exist, so a bad
    // PDF fails the whole request cleanly rather than leaving a note with
    // only some of its intended pages.
    const pages = await rasterizePdfPages(bytes);
    return pages.map((pageBytes) => ({ bytes: pageBytes, ext: "jpg" }));
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return [{ bytes, ext }];
}

// Async processing (per claude/09-walking-skeleton-architecture.md's
// "Synchronous upload" note, superseding the walking-skeleton's original
// deliberate deviation from FR-2.5/FR-17.1): upload only saves the file(s)
// and enqueues one processing_jobs row for the whole note, then returns
// immediately - it never itself awaits any AI call. The actual transcribe
// (batched across pages) + tag-suggestion work now lives in src/lib/jobs.ts,
// run by the in-process job runner started from src/instrumentation.ts. The
// note page polls GET /api/notes/[id] and shows a "still processing" state
// (per page) until the batch job completes.
//
// Multi-page notes (FR-2.4): one upload can carry several page images under
// the repeated "images" field, in the order the client sent them - that
// order becomes each page's page_number. All pages are grouped under one
// new note row from the start, matching the spec's "explicitly grouped into
// a single logical multi-page note." A PDF is accepted here too and expanded
// into one page per PDF page (preparePages/pdfPrep.ts) at the position it
// was uploaded in, so a PDF and photographed pages can be mixed freely in
// one upload and still end up as one ordered sequence of note_pages rows.
//
// All pages are enqueued as a single batch job (enqueueNoteTranscribeJob),
// not one job per page: one AI provider call covers every page, which avoids
// resending the system prompt/handwriting-context text once per page (see
// ai/types.ts's TranscribeBatchInput doc comment). Per-page retry after this
// point still uses individual single-image jobs - see /[id]/retry/route.ts.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No image files provided." }, { status: 400 });
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type}". Use JPEG, PNG, WebP, or PDF.` },
        { status: 400 }
      );
    }
  }

  // Expand every file into its final page(s) - a PDF becomes N rasterized
  // pages, an image stays exactly one - before creating anything in the
  // database. A bad PDF (too many pages, corrupted, password-protected)
  // fails the whole request here with a clear error, rather than after a
  // note and some of its pages already exist.
  let pages: PreparedPage[];
  try {
    pages = (await Promise.all(files.map(preparePages))).flat();
  } catch (err) {
    if (err instanceof PdfTooLargeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Couldn't read one of the uploaded PDFs.";
    return NextResponse.json(
      { error: `Couldn't read a PDF - it may be corrupted or password-protected. (${message})` },
      { status: 400 }
    );
  }

  const noteId = randomUUID();
  const now = new Date().toISOString();
  notesRepo.create({ id: noteId, title: null, createdAt: now });

  // Failure partway through does not lose already-saved pages or the note
  // itself (FR-3.8/FR-13.2) - each page is its own durable row, and a page
  // whose job later fails leaves that page in a recoverable 'error' state
  // (see jobs.ts's runOneJob) with a per-page Retry action still available.
  for (let i = 0; i < pages.length; i++) {
    const { bytes, ext } = pages[i];
    const pageId = randomUUID();
    const relativePath = `uploads/${pageId}.${ext}`;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);

    notePagesRepo.create({
      id: pageId,
      noteId,
      pageNumber: i + 1,
      imagePath: relativePath,
      createdAt: now,
    });
  }

  enqueueNoteTranscribeJob(noteId);

  return NextResponse.json({ id: noteId }, { status: 201 });
}
