import { randomUUID } from "crypto";
import { notesRepo, notePagesRepo, tagsRepo, noteTagsRepo, processingJobsRepo } from "./db";
import { getAIProvider } from "./ai";
import { getHandwritingContext } from "./handwritingProfile";
import { CONFIDENCE_THRESHOLD } from "./config";
import { derivePlaceholderTitle } from "./titleGen";

// Narrowed from 04-data-model.md's processing_jobs / §28's multi-stage
// pipeline down to the one stage this app actually has: transcription (plus
// the one-time AI tag suggestion, which piggybacks on the same job rather
// than getting its own row, since it's best-effort and non-blocking either
// way - see the try/catch below). ANALYZE_NOTE, GENERATE_SUMMARY, etc. don't
// exist yet, so there's nothing else to stage.
//
// Multi-page notes (02-architecture.md §8: "processed page-by-page for
// TRANSCRIBE ... then merged into one logical note"): this stage is now
// scoped to one *page*, not one note - a job's note_id says which note to
// re-check/aggregate afterward, but the actual transcribe call and its
// result apply to a single note_pages row (job.page_id). A note's pages are
// each enqueued independently at upload time and transcribe fully
// independently; the only cross-page coordination is the note-level status
// aggregate (notesRepo.recomputeStatus) and the one-time tag suggestion,
// which waits until every page for the note has left 'uploaded'/
// 'transcribing' before running once over all pages' merged text.
const STAGE_TRANSCRIBE = "transcribe";

// Runs the transcribe stage for one page: real work moved out of the upload/
// retry route handlers (which now just enqueue a job and return immediately)
// so both entry points share one implementation. Throws on failure - the
// caller (runOneJob below) is what records success/failure against the job
// row and flips that page (not the whole note) to 'error'.
async function runTranscribeJob(pageId: string): Promise<void> {
  const page = notePagesRepo.getById(pageId);
  if (!page) throw new Error(`Note page ${pageId} not found - it may have been deleted mid-job.`);

  const provider = getAIProvider();
  const result = await provider.transcribe({
    imagePath: page.image_path,
    handwritingContext: getHandwritingContext(),
    confidenceThreshold: CONFIDENCE_THRESHOLD,
  });
  const now = new Date().toISOString();
  notePagesRepo.setTranscribed(pageId, result.segments, now);

  // Only page 1 ever supplies the placeholder title (COALESCE-guarded, so a
  // user-set title is never touched) - matches the old single-page behavior
  // exactly for a one-page note, and reads naturally as "titled from the
  // start of the document" for a multi-page one.
  if (page.page_number === 1) {
    notesRepo.setPlaceholderTitle(page.note_id, derivePlaceholderTitle(result.segments), now);
  }

  notesRepo.recomputeStatus(page.note_id, now);

  // Best-effort AI tag suggestion, once per *note* (not per page), gated by
  // hasAnyForNote so a later per-page retry doesn't silently re-add a tag
  // the user removed (AC-9). Runs only once every page for this note has
  // left 'uploaded'/'transcribing' - a note-type suggestion made from one
  // page out of several would be working from a fraction of the content. A
  // failure here must not fail an otherwise-successful transcription.
  try {
    const allPages = notePagesRepo.listForNote(page.note_id);
    const stillWorking = allPages.some((p) => p.status === "uploaded" || p.status === "transcribing");
    if (!stillWorking && !noteTagsRepo.hasAnyForNote(page.note_id)) {
      const transcriptionText = allPages
        .flatMap((p) => p.segmentsAi)
        .filter((s) => !s.crossedOut)
        .map((s) => s.text)
        .join(" ");
      if (transcriptionText.trim()) {
        const existingUserTags = tagsRepo.listAll().map((t) => t.name);
        const { tags } = await provider.generateTags({
          transcription: transcriptionText,
          existingUserTags,
        });
        const resolved = tags.map((t) => ({
          ...tagsRepo.findOrCreate(t.name, new Date().toISOString()),
          confidence: t.confidence,
        }));
        noteTagsRepo.setForNote(
          page.note_id,
          resolved.map((t) => ({ tagId: t.id, source: "ai" as const, confidence: t.confidence })),
          new Date().toISOString()
        );
      }
    }
  } catch (tagErr) {
    console.error("AI tag suggestion failed (non-fatal):", tagErr);
  }
}

const STAGE_RUNNERS: Record<string, (pageId: string) => Promise<void>> = {
  [STAGE_TRANSCRIBE]: runTranscribeJob,
};

export function enqueuePageTranscribeJob(pageId: string, noteId: string): void {
  const now = new Date().toISOString();
  processingJobsRepo.enqueue({
    id: randomUUID(),
    noteId,
    pageId,
    stage: STAGE_TRANSCRIBE,
    createdAt: now,
  });
  notePagesRepo.setTranscribing(pageId, now);
  notesRepo.recomputeStatus(noteId, now);
}

// Claims and runs a single queued job, if one exists. Returns true if a job
// was found (regardless of whether it succeeded), so the runner loop can
// poll again immediately instead of waiting out a full idle tick.
async function runOneJob(): Promise<boolean> {
  const job = processingJobsRepo.claimNext(new Date().toISOString());
  if (!job) return false;

  const run = STAGE_RUNNERS[job.stage];
  try {
    if (!run) throw new Error(`Unknown processing job stage "${job.stage}".`);
    if (!job.page_id) throw new Error(`Job ${job.id} has no page_id - cannot run stage "${job.stage}".`);
    await run(job.page_id);
    processingJobsRepo.markSucceeded(job.id, new Date().toISOString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    const now = new Date().toISOString();
    processingJobsRepo.markFailed(job.id, message, now);
    // Failure belongs to the one page that failed, not the whole note - the
    // other pages may have already succeeded or may still be transcribing.
    if (job.page_id) notePagesRepo.setError(job.page_id, message, now);
    notesRepo.recomputeStatus(job.note_id, now);
  }
  return true;
}

let runnerStarted = false;

// Single in-process poller - one job at a time, checked every POLL_MS, plus
// an immediate re-check after a job runs so a burst of uploads doesn't each
// wait out a full idle interval. This is deliberately the "lightweight"
// half of the durable-jobs design: no separate worker process, no real
// queue broker - just a durable table (processing_jobs) so a crash mid-job
// leaves a recoverable row instead of losing the work silently, which is
// what the walking skeleton's original synchronous-upload had no way to
// avoid. Suits a single local user; would need a real queue (per
// 02-architecture.md §8) to scale beyond one process.
const POLL_MS = 1000;
const ORPHAN_AFTER_MS = 5 * 60 * 1000; // a 'running' job older than this is assumed crashed, not slow

export function startJobRunner(): void {
  if (runnerStarted) return;
  runnerStarted = true;

  const requeued = processingJobsRepo.requeueOrphanedRunning(ORPHAN_AFTER_MS);
  if (requeued > 0) {
    console.log(`Requeued ${requeued} processing job(s) left 'running' by a previous process.`);
  }

  const tick = () => {
    runOneJob()
      .then((didWork) => setTimeout(tick, didWork ? 0 : POLL_MS))
      .catch((err) => {
        console.error("Job runner tick failed unexpectedly:", err);
        setTimeout(tick, POLL_MS);
      });
  };
  tick();
}
