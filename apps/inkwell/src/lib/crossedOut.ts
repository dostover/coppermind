import type { TranscriptSegment } from "@/lib/ai/types";

// Crossed-out handwriting (2026-11-03): still detected by the AI and shown
// struck through on the review screen - so the writer can check it was read
// right and un-strike anything misjudged - but left out of everything after
// that: the saved note, both exports, library/search snippets. The raw AI
// output (segments_ai) keeps it, so nothing is truly lost.
//
// Dropping a segment can't just filter it out: when the dropped segment is
// the one that *starts* a line (startsNewBlock), the continuation segments
// after it would otherwise glue themselves onto the line above. So the first
// kept segment after a dropped line-starter inherits startsNewBlock. Every
// renderer already joins segments within a line with a single space, so
// removing a word mid-sentence leaves "the wizard", never "the  wizard" or
// "thewizard".
export function withoutCrossedOut(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  const kept: TranscriptSegment[] = [];
  let lineStartDropped = false;
  segments.forEach((segment, i) => {
    const startsLine = i === 0 || segment.startsNewBlock;
    if (segment.crossedOut) {
      if (startsLine) lineStartDropped = true;
      return;
    }
    if (startsLine) {
      lineStartDropped = false;
      kept.push(segment);
    } else if (lineStartDropped) {
      lineStartDropped = false;
      kept.push({ ...segment, startsNewBlock: true });
    } else {
      kept.push(segment);
    }
  });
  return kept;
}

/** Plain text of a segment list with crossed-out text left out. */
export function visibleText(
  segments: TranscriptSegment[],
  separator = " ",
): string {
  return withoutCrossedOut(segments)
    .map((s) => s.text)
    .join(separator);
}
