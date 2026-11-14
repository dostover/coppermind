import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { notePagesRepo } from "@/lib/db";
import { enqueueNoteTranscribeJob, enqueueRasterizePdfJob } from "@/lib/jobs";
import { PdfEmptyError, PdfTooLargeError, getPdfPageCount } from "@/lib/pdfPrep";

// Shared by both ways pages enter a note: a new upload (POST
// /api/notes/upload, pages start at 1) and adding pages to an existing note
// (POST /api/notes/[id]/pages, pages start after the note's last page - for
// a chapter written in instalments, 2026-11-13). Moved out of the upload
// route unchanged so both paths validate, expand PDFs and enqueue jobs the
// same way.

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
export type PreparedPage =
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


// Returns an error message for the request, or null when every file is
// acceptable.
export function validateUploadedFiles(files: File[]): string | null {
  if (files.length === 0) return "No image files provided.";
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return `Unsupported file type "${file.type}". Use JPEG, PNG, WebP, or PDF.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)}MB - the limit per file is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`;
    }
  }
  return null;
}

// Expands every file into its final page slot(s) - a PDF becomes N
// placeholder slots, an image exactly one - before anything is written to
// the database, so a bad PDF (too many pages, corrupted, password-protected)
// fails the whole request with a clear error.
export async function prepareUploadedFiles(
  files: File[]
): Promise<{ pages: PreparedPage[] } | { error: string }> {
  try {
    return { pages: (await Promise.all(files.map(preparePages))).flat() };
  } catch (err) {
    if (err instanceof PdfTooLargeError || err instanceof PdfEmptyError) {
      return { error: err.message };
    }
    const message = err instanceof Error ? err.message : "Couldn't read one of the uploaded PDFs.";
    return { error: `Couldn't read a PDF - it may be corrupted or password-protected. (${message})` };
  }
}

// Creates one note_pages row per prepared page, numbered from
// firstPageNumber in order, then enqueues processing. Only pages still
// 'uploaded' are ever transcribed (see jobs.ts's runBatchTranscribeJob and
// enqueueNoteTranscribeJob), so when this adds pages to an existing note the
// pages already there are never re-transcribed and their saved text is left
// alone.
//
// Failure partway through does not lose already-saved pages or the note
// itself (FR-3.8/FR-13.2) - each page is its own durable row, and a page
// whose job later fails leaves that page in a recoverable 'error' state
// with a per-page Retry action still available. A PDF's pages are grouped by
// their shared source file (pdfPath) so one rasterize_pdf job can be
// enqueued per uploaded PDF, covering exactly the placeholder rows created
// for it, in order. When any PDF page is pending, the batch transcribe job
// is enqueued later by jobs.ts's rasterize_pdf stage instead of here.
export async function createPagesForNote(
  noteId: string,
  pages: PreparedPage[],
  firstPageNumber: number,
  now: string
): Promise<string[]> {
  const createdIds: string[] = [];
  const pdfPageIdsByPath = new Map<string, string[]>();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageId = randomUUID();
    const pageNumber = firstPageNumber + i;

    if (page.kind === "pdfPlaceholder") {
      notePagesRepo.create({ id: pageId, noteId, pageNumber, imagePath: "", createdAt: now });
      const ids = pdfPageIdsByPath.get(page.pdfPath) ?? [];
      ids.push(pageId);
      pdfPageIdsByPath.set(page.pdfPath, ids);
      createdIds.push(pageId);
      continue;
    }

    const relativePath = `uploads/${pageId}.${page.ext}`;
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, page.bytes);

    notePagesRepo.create({ id: pageId, noteId, pageNumber, imagePath: relativePath, createdAt: now });
    createdIds.push(pageId);
  }

  if (pdfPageIdsByPath.size > 0) {
    for (const [pdfPath, pageIds] of pdfPageIdsByPath) {
      enqueueRasterizePdfJob(noteId, pdfPath, pageIds);
    }
  } else {
    enqueueNoteTranscribeJob(noteId);
  }
  return createdIds;
}
