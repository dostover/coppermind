import type { TranscriptSegment } from "./ai/types";

// Placeholder title generation (AC-10 / Definition of Done #10). Real
// AI-generated titles (noteType-aware, per the full Phase 5 contract) are
// deferred along with summarization/tags - see claude/08-walking-skeleton-scope.md
// ("adaptive per-note-type summarization ... beyond perhaps a placeholder
// summary"). This gives every note a real title instead of "Untitled" in the
// meantime, derived from the note's own first line - no extra AI call.
//
// Callers must only apply this when the note has no user-set title yet
// (see notesRepo.setTranscribed's COALESCE), so a title the user typed or
// edited is never overwritten by a later reprocess/retry.
const MAX_LEN = 60;

export function derivePlaceholderTitle(segments: TranscriptSegment[]): string | null {
  const first = segments.find((s) => !s.crossedOut && s.text.trim().length > 0);
  if (!first) return null;

  const text = first.text.trim().replace(/\s+/g, " ");
  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN).trimEnd()}…` : text;
}
