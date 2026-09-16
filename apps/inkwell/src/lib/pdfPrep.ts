// PDF ingestion: turns an uploaded PDF into the same thing a photographed
// page already is - a JPEG buffer - so it can flow through the rest of the
// pipeline (imagePrep.ts's resize/EXIF step, note_pages, transcription,
// gridOverlay.ts) completely unchanged. A PDF page becomes one note_pages
// row exactly like an uploaded image does; nothing downstream needs to know
// where the bytes originally came from.
//
// Uses `pdf-to-img` (a thin wrapper over `pdfjs-dist`) rather than shelling
// out to a system tool like poppler's `pdftoppm`: it's a pure npm dependency
// with no native/system binary to install, which matters since this app has
// no deployment/build step for external tools - `npm install` is the only
// setup a user or CI needs to do.
import { pdf } from "pdf-to-img";

// A safety cap, not a product limit - without one, a single mis-picked huge
// PDF (a scanned book, say) would silently try to enqueue dozens of
// transcription pages in one batch job. Chosen well above any real
// hand-written note's realistic page count.
export const MAX_PDF_PAGES = 30;

export class PdfTooLargeError extends Error {
  constructor(public pageCount: number) {
    super(`This PDF has ${pageCount} pages - the limit per upload is ${MAX_PDF_PAGES}.`);
    this.name = "PdfTooLargeError";
  }
}

// Just enough of pdf-to-img's work to validate an upload and learn how many
// placeholder note_pages rows to create - reading a PDF's own page count/
// metadata is cheap (confirmed ~300ms even on an 8.4MB/14-page real scan)
// entirely independent of rendering any page, which is the genuinely slow,
// page-count-scaled part (see rasterizePdfPages below). This is what the
// upload route calls synchronously; actual rendering happens later, off the
// request, in jobs.ts's rasterize_pdf stage. Still throws PdfTooLargeError/a
// corrupted-PDF error exactly like rasterizePdfPages used to, so upload-time
// validation is unchanged - only the expensive rendering moved.
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await pdf(buffer, { format: "jpg", scale: 2 });
  try {
    if (doc.length > MAX_PDF_PAGES) {
      throw new PdfTooLargeError(doc.length);
    }
    return doc.length;
  } finally {
    await doc.destroy();
  }
}

// Renders every page of a PDF to its own JPEG buffer, in page order. Scale 2
// (~144 DPI off a standard 72dpi PDF unit) comfortably covers a phone-photo's
// worth of handwriting detail without producing huge files - imagePrep.ts's
// downstream resize step still applies its own ceiling on top of this.
export async function rasterizePdfPages(buffer: Buffer): Promise<Buffer[]> {
  const doc = await pdf(buffer, { format: "jpg", scale: 2 });

  if (doc.length > MAX_PDF_PAGES) {
    await doc.destroy();
    throw new PdfTooLargeError(doc.length);
  }

  const pages: Buffer[] = [];
  try {
    for await (const page of doc) {
      pages.push(page);
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
