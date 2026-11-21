import { notesRepo } from "@/lib/db";
import { indexNote } from "@/lib/searchIndex";
import { syncRevisedFromGoogleDoc } from "./docsSync";
import { isGoogleConnected } from "./oauth";

// Reads every linked Google Doc right before something that depends on the
// reworked text (Ask), instead of relying on a timer to have done it. Notes
// whose Doc was read in the last FRESH_FOR_MS are skipped, so asking several
// questions in a row doesn't re-read every Doc each time. A changed Doc is
// re-indexed inline, so the answer already sees the new passages.
//
// Best-effort and time-boxed: a slow or failing Docs read never blocks or
// fails the caller - it just answers from what was last read. Work still
// running at the deadline finishes in the background.

const FRESH_FOR_MS = 2 * 60 * 1000;
const DEADLINE_MS = 8000;
const CONCURRENCY = 4;

export interface RefreshSummary {
  checked: number;
  changed: number;
  timedOut: boolean;
}

export async function refreshLinkedDocsBeforeUse(now = Date.now()): Promise<RefreshSummary> {
  if (!isGoogleConnected()) return { checked: 0, changed: 0, timedOut: false };

  const due = notesRepo.listIdsWithGoogleDoc().filter((id) => {
    const syncedAt = notesRepo.getById(id)?.revised_synced_at;
    return !syncedAt || now - new Date(syncedAt).getTime() > FRESH_FOR_MS;
  });
  if (due.length === 0) return { checked: 0, changed: 0, timedOut: false };

  let changed = 0;
  const queue = [...due];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const { needsReindex } = await syncRevisedFromGoogleDoc(id);
        if (needsReindex) {
          await indexNote(id);
          changed++;
        }
      } catch (err) {
        console.error(`Reading the Google Doc for note ${id} before use failed (non-fatal):`, err);
      }
    }
  };
  const all = Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), DEADLINE_MS);
  });
  const outcome = await Promise.race([all.then(() => "done" as const), deadline]);
  clearTimeout(timer);
  return { checked: due.length, changed, timedOut: outcome === "timeout" };
}
