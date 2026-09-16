import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo, notePagesRepo } from "@/lib/db";
import { enqueueNoteTranscribeJob, enqueueRasterizePdfJob } from "@/lib/jobs";
import { PdfEmptyError, PdfTooLargeError, getPdfPageCount } from "@/lib/pdfPrep";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

// A safety cap, not a product limit (same spirit as pdfPrep's MAX_PDF_PAGES):
// nothing previously stopped an arbitrarily large file from being buffered
// into memory in full (preparePages reads the whole thing via
// file.arrayBuffer()) and written to disk. 50MB comfortably covers a
// high-resolution phone photo or a scanned multi-page PDF.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// One page-to-be, in upload order, before any note_pages row exists. An
// image is ready to write as-is. A PDF is *not* rasterized here - that's the
// slow, page-count-scaled part (confirmed ~1.1s/page on a real scan; ~15.6s
// total for a 14-page one), and doing it inline here is exactly what used to
// block this route's response long enough to trip the browser's own fetch
// timeout ("Failed to fetch"). All this does for a PDF is the fast bit
// (~300ms even on a large file): read its page count, so the right number of
// placeholder rows can be created immediately, and save the raw bytes so a
// background job (jobs.ts's rasterize_pdf stage) can render them after this
// request has already returned.
type PreparedPage =
  | { kind: "image"; bytes: Buffer; ext: "jpg" | "png" | "webp" }
  | { kind: "pdfPlaceholder"; pdfPath: string };

async function preparePages(file: File): Promise<PreparedPage[]> {
  const bytes = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    // Validate (page count, corruption, password protection) up front, same
    // as before - a bad PDF still fails the whole request cleanly, before
    // the note or any page rows exist. Just no per-page rendering yet.
    const pageCount = await getPdfPageCount(bytes);

    const pdfPath = path.join(process.cwd(), "data", "pdf-sources", `${randomUUID()}.pdf`);
    await mkdir(path.dirname(pdfPath), { recursive: true });
    await writeFile(pdfPath, bytes);

    return Array.from({ length: pageCount }, () => ({ kind: "pdfPlaceholder", pdfPath }) as const);
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return [{ kind: "image", bytes, ext }];
}

// Async processing (per claude/09-walking-skeleton-architecture.md's
// "Synchronous upload" note, superseding the walking-skeleton's original
// deliberate deviation from FR-2.5/FR-17.1): upload only saves the file(s)
// and enqueues processing_jobs row(s) for the note, then returns immediately
// - it never itself awaits any AI call, and (as of the PDF-upload fix below)
// never itself rasterizes a PDF either. The actual transcribe (batched
// across pages) + tag-suggestion work, and now PDF page rendering too, live
// in src/lib/jobs.ts, run by the in-process job runner started from
// src/instrumentation.ts. The note page polls GET /api/notes/[id] and shows
// a "still processing" state (per page) until each page's job completes.
//
// Multi-page notes (FR-2.4): one upload can carry several page images under
// the repeated "images" field, in the order the client sent them - that
// order becomes each page's page_number. All pages are grouped under one
// new note row from the start, matching the spec's "explicitly grouped into
// a single logical multi-page note." A PDF is accepted here too and expanded
// into one page per PDF page, at the position it was uploaded in, so a PDF
// and photographed pages can be mixed freely in one upload and still end up
// as one ordered sequence of note_pages rows - a PDF's pages just start out
// as placeholders (imagePath "") that fill in once their rasterize_pdf job
// runs, rather than existing immediately like a photographed page's does.
//
// All non-PDF-pending pages are enqueued as a single batch job
// (enqueueNoteTranscribeJob), not one job per page: one AI provider call
// covers every page, which avoids resending the system prompt/handwriting-
// context text once per page (see ai/types.ts's TranscribeBatchInput doc
// comment). When any PDF page is still pending rasterization, that batch job
// is deliberately *not* enqueued yet - jobs.ts's rasterize_pdf stage enqueues
// it itself, once every page of the note has a real image. Per-page retry
// after this point still uses individual single-image jobs - see
// /[id]/retry/route.ts.
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
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB - the limit per file is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        },
        { status: 400 }
      );
    }
  }

  // Expand every file into its final page slot(s) - a PDF becomes N
  // placeholder slots (filled in later by a background job), an image stays
  // exactly one - before creating anything in the database. A bad PDF (too
  // many pages, corrupted, password-protected) fails the whole request here
  // with a clear error, rather than after a note and some of its pages
  // already exist. This whole step is now fast regardless of PDF size/page
  // count - it never renders a page.
  let pages: PreparedPage[];
  try {
    pages = (await Promise.all(files.map(preparePages))).flat();
  } catch (err) {
    if (err instanceof PdfTooLargeError || err instanceof PdfEmptyError) {
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
  // A PDF's pages are grouped by their shared source file (pdfPath) so one
  // rasterize_pdf job can be enqueued per uploaded PDF, covering exactly the
  // placeholder rows created for it, in order.
  const pdfPageIdsByPath = new Map<string, string[]>();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageId = randomUUID();

    if (page.kind === "pdfPlaceholder") {
      notePagesRepo.create({
        id: pageId,
        noteId,
        pageNumber: i + 1,
        imagePath: "",
        createdAt: now,
      });
      const ids = pdfPageIdsByPath.get(page.pdfPath) ?? [];
      ids.push(pageId);
      pdfPageIdsByPath.set(page.pdfPath, ids);
      continue;
    }

    const relativePath = `uploads/${pageId}.${page.ext}`;
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, page.bytes);

    notePagesRepo.create({
      id: pageId,
      noteId,
      pageNumber: i + 1,
      imagePath: relativePath,
      createdAt: now,
    });
  }

  if (pdfPageIdsByPath.size > 0) {
    for (const [pdfPath, pageIds] of pdfPageIdsByPath) {
      enqueueRasterizePdfJob(noteId, pdfPath, pageIds);
    }
    // enqueueNoteTranscribeJob runs later, once jobs.ts sees every one of
    // this note's pages has a real image - see its rasterize_pdf stage.
  } else {
    enqueueNoteTranscribeJob(noteId);
  }

  return NextResponse.json({ id: noteId }, { status: 201 });
}
