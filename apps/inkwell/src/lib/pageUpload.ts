import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import db, { notePagesRepo } from "@/lib/db";
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

// Creates one note_pages row per prepared page, numbered in order from
// firstPageNumber, then enqueues processing. Only pages still 'uploaded' are
// ever transcribed (see jobs.ts's runBatchTranscribeJob and
// enqueueNoteTranscribeJob), so when this adds pages to an existing note the
// pages already there are never re-transcribed and their saved text is left
// alone.
//
// firstPageNumber can be a function, read inside the same synchronous
// transaction as the inserts (better-sqlite3 is synchronous, so nothing else
// can run in between). Adding pages passes "the note's last page + 1" this
// way: two add requests arriving together used to both read the same last
// page number while their image files were still being written, and the
// second one failed on UNIQUE (note_id, page_number), losing its photos
// (found in verification, 2026-11-13). Image files are now written first,
// then every row is inserted in one transaction, so a failure leaves no
// half-added pages stuck in 'uploaded' with no job queued - the request
// fails as a whole and the files it wrote are removed.
//
// A PDF's pages are grouped by their shared source file (pdfPath) so one
// rasterize_pdf job can be enqueued per uploaded PDF, covering exactly the
// placeholder rows created for it, in order. When any PDF page is pending,
// the batch transcribe job is enqueued later by jobs.ts's rasterize_pdf
// stage instead of here. A page whose job later fails stays in a
// recoverable 'error' state with a per-page Retry (FR-3.8/FR-13.2).
export async function createPagesForNote(
  noteId: string,
  pages: PreparedPage[],
  firstPageNumber: number | (() => number),
  now: string
): Promise<string[]> {
  const planned = pages.map((page) => {
    const pageId = randomUUID();
    const imagePath = page.kind === "image" ? `uploads/${pageId}.${page.ext}` : "";
    return { page, pageId, imagePath };
  });

  const written: string[] = [];
  try {
    for (const { page, imagePath } of planned) {
      if (page.kind !== "image") continue;
      const absolutePath = path.join(process.cwd(), "public", imagePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, page.bytes);
      written.push(absolutePath);
    }

    db.transaction(() => {
      const first = typeof firstPageNumber === "function" ? firstPageNumber() : firstPageNumber;
      planned.forEach(({ pageId, imagePath }, i) => {
        notePagesRepo.create({ id: pageId, noteId, pageNumber: first + i, imagePath, createdAt: now });
      });
    })();
  } catch (err) {
    await Promise.all(written.map((f) => unlink(f).catch(() => {})));
    throw err;
  }

  const pdfPageIdsByPath = new Map<string, string[]>();
  for (const { page, pageId } of planned) {
    if (page.kind !== "pdfPlaceholder") continue;
    const ids = pdfPageIdsByPath.get(page.pdfPath) ?? [];
    ids.push(pageId);
    pdfPageIdsByPath.set(page.pdfPath, ids);
  }
  if (pdfPageIdsByPath.size > 0) {
    for (const [pdfPath, pageIds] of pdfPageIdsByPath) {
      enqueueRasterizePdfJob(noteId, pdfPath, pageIds);
    }
  } else {
    enqueueNoteTranscribeJob(noteId);
  }
  return planned.map((p) => p.pageId);
}
