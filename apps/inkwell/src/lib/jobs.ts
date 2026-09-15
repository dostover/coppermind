import { randomUUID } from "crypto";
import { notesRepo, tagsRepo, noteTagsRepo, processingJobsRepo } from "./db";
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
const STAGE_TRANSCRIBE = "transcribe";

// Runs the transcribe stage for one note: real work moved out of the upload/
// retry route handlers (which now just enqueue a job and return immediately)
// so both entry points share one implementation. Throws on failure - the
// caller (runOneJob below) is what records success/failure against the job
// row and flips the note to 'error'.
async function runTranscribeJob(noteId: string): Promise<void> {
  const note = notesRepo.getById(noteId);
  if (!note) throw new Error(`Note ${noteId} not found - it may have been deleted mid-job.`);

  const provider = getAIProvider();
  const result = await provider.transcribe({
    imagePath: note.image_path,
    handwritingContext: getHandwritingContext(),
    confidenceThreshold: CONFIDENCE_THRESHOLD,
  });
  notesRepo.setTranscribed(
    noteId,
    result.segments,
    new Date().toISOString(),
    derivePlaceholderTitle(result.segments)
  );

  // Best-effort AI tag suggestion, one time only (gated by hasAnyForNote so
  // a later retry doesn't silently re-add a tag the user removed - AC-9). A
  // failure here must not fail an otherwise-successful transcription.
  try {
    if (!noteTagsRepo.hasAnyForNote(noteId)) {
      const transcriptionText = result.segments
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
          noteId,
          resolved.map((t) => ({ tagId: t.id, source: "ai" as const, confidence: t.confidence })),
          new Date().toISOString()
        );
      }
    }
  } catch (tagErr) {
    console.error("AI tag suggestion failed (non-fatal):", tagErr);
  }
}

const STAGE_RUNNERS: Record<string, (noteId: string) => Promise<void>> = {
  [STAGE_TRANSCRIBE]: runTranscribeJob,
};

export function enqueueTranscribeJob(noteId: string): void {
  processingJobsRepo.enqueue({
    id: randomUUID(),
    noteId,
    stage: STAGE_TRANSCRIBE,
    createdAt: new Date().toISOString(),
  });
  notesRepo.setTranscribing(noteId, new Date().toISOString());
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
    await run(job.note_id);
    processingJobsRepo.markSucceeded(job.id, new Date().toISOString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    processingJobsRepo.markFailed(job.id, message, new Date().toISOString());
    notesRepo.setError(job.note_id, message, new Date().toISOString());
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
