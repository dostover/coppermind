import { readdirSync, statSync, unlinkSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { processingJobsRepo } from "./db";

// Raw uploaded PDFs wait in data/pdf-sources/ until their rasterize_pdf job
// renders them (upload route -> jobs.ts). The job deletes its PDF once it
// succeeds, but a PDF could be left behind when its note was purged before
// the job ran (the job row cascade-deletes with the note) or when the job
// failed. This module removes those leftovers without ever touching a PDF a
// queued or running job still needs.

// Must match jobs.ts's STAGE_RASTERIZE_PDF (not imported from there: jobs.ts
// imports this module).
const RASTERIZE_PDF_STAGE = "rasterize_pdf";

const KEEP = new Set([".gitkeep"]);

export function pdfSourcesDir(): string {
  return path.join(process.cwd(), "data", "pdf-sources");
}

function pdfPathsOf(payloads: string[]): string[] {
  const paths: string[] = [];
  for (const payload of payloads) {
    try {
      const { pdfPath } = JSON.parse(payload) as { pdfPath?: unknown };
      if (typeof pdfPath === "string" && pdfPath) paths.push(pdfPath);
    } catch {
      // A malformed payload can't name a file - nothing to protect or remove.
    }
  }
  return paths;
}

// File names (not full paths - the payload holds an absolute path, which
// would no longer match if the app folder moved) of every PDF a queued or
// running rasterize_pdf job still needs.
function namesStillNeeded(): Set<string> {
  const payloads = processingJobsRepo.listPayloads(RASTERIZE_PDF_STAGE, ["queued", "running"]);
  return new Set(pdfPathsOf(payloads).map((p) => path.basename(p)));
}

// Startup sweep: deletes every file in data/pdf-sources/ that no queued or
// running job refers to, and logs how many. Synchronous on purpose - it runs
// from startJobRunner before the server takes requests, so an upload can't
// be midway between saving its PDF and enqueueing that PDF's job.
export function sweepOrphanedPdfSources(): number {
  const dir = pdfSourcesDir();
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    console.log("Removed 0 orphaned PDF source file(s) from data/pdf-sources/.");
    return 0; // no folder yet, nothing to clean
  }

  const needed = namesStillNeeded();
  let removed = 0;
  for (const name of names) {
    if (KEEP.has(name) || needed.has(name)) continue;
    const filePath = path.join(dir, name);
    try {
      if (!statSync(filePath).isFile()) continue;
      unlinkSync(filePath);
      removed++;
    } catch (err) {
      console.error(`Couldn't remove orphaned PDF source ${name}:`, err);
    }
  }
  console.log(`Removed ${removed} orphaned PDF source file(s) from data/pdf-sources/.`);
  return removed;
}

// The PDFs of this note's *queued* rasterize_pdf jobs - read before the note
// is purged, since purging cascade-deletes the job rows that name them. A
// running job's PDF is not included: that job is reading it right now.
export function queuedPdfSourcesForNote(noteId: string): string[] {
  return pdfPathsOf(processingJobsRepo.listPayloads(RASTERIZE_PDF_STAGE, ["queued"], noteId));
}

// Deletes the given PDFs (from queuedPdfSourcesForNote, after the purge),
// skipping any a running job has picked up in the meantime and anything
// outside data/pdf-sources/. Best-effort: a file already gone is fine.
export async function removePdfSources(pdfPaths: string[]): Promise<void> {
  if (pdfPaths.length === 0) return;
  const dir = pdfSourcesDir();
  const needed = namesStillNeeded();
  for (const pdfPath of pdfPaths) {
    const name = path.basename(pdfPath);
    if (KEEP.has(name) || needed.has(name)) continue;
    await unlink(path.join(dir, name)).catch(() => {});
  }
}
