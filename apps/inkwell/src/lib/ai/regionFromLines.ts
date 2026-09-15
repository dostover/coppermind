import type { SourceRegion } from "./types";

// Why this exists: the first version of image-region highlighting (PR #9)
// asked ClaudeAIProvider to report a tight bounding box per segment
// directly - [x, y, width, height] fractions, regressed by the model in one
// shot. Tested live against a real photo, that came back noticeably
// wrong/off - unsurprising in hindsight, since precise continuous-coordinate
// grounding on handwriting is a much harder ask for a general vision model
// than the things it's already reliably good at (reading order, counting).
//
// This replaces that with a much easier per-segment question - "which line
// of handwriting, counting from the top, is this on?" - and computes the
// actual bbox geometry ourselves from that, rather than trusting the model's
// raw coordinates. This is explicitly sanctioned by 01-requirements.md's
// assumption A5: "the schema does not require word-level precision" - a
// line-level (or coarser) region is fine. Two consequences worth knowing:
//   - Vertical position/height is now exact-ish (evenly divided by line
//     count over an assumed content area), driven entirely by the model's
//     line-counting, which should be far more reliable than pixel coordinates.
//   - Horizontal position is a heuristic, not something the model reports at
//     all: segments sharing a line are allocated left-to-right in emission
//     order (already reading order) with width proportional to text length.
//     This can't localize a specific word within a line as tightly as a real
//     per-word box would, but it degrades to "roughly the right line and
//     roughly the right horizontal neighborhood" rather than "a box anywhere
//     on the page," which is the failure mode being fixed.
//
// Still unverified against a real photo (no live API key in this sandbox) -
// see the Asana Discovery Item this shipped alongside.

const TOP_MARGIN = 0.05;
const BOTTOM_MARGIN = 0.05;
const LEFT_MARGIN = 0.06;
const RIGHT_MARGIN = 0.06;
// Leaves a small visual gap between stacked line bands rather than having
// them touch edge-to-edge, which reads as a tighter, more deliberate highlight.
const LINE_FILL_RATIO = 0.82;

export interface LineTaggedSegment {
  text: string;
  /** 1-indexed line number as reported by the model; undefined/invalid = unlocatable. */
  lineNumber?: number;
}

/**
 * Computes one SourceRegion (or null) per input segment, in the same order,
 * from nothing but each segment's reported line number and text length.
 */
export function computeLineBasedRegions(
  segments: LineTaggedSegment[]
): (SourceRegion | null)[] {
  const validLineNumbers = segments
    .map((s) => s.lineNumber)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 1);

  if (validLineNumbers.length === 0) {
    return segments.map(() => null);
  }

  const maxLine = Math.max(...validLineNumbers);
  const usableHeight = 1 - TOP_MARGIN - BOTTOM_MARGIN;
  const lineHeight = usableHeight / maxLine;
  const usableWidth = 1 - LEFT_MARGIN - RIGHT_MARGIN;

  // Group segment indices by line, preserving emission order within a line
  // (already left-to-right reading order coming out of transcribe()).
  const indicesByLine = new Map<number, number[]>();
  segments.forEach((s, i) => {
    if (typeof s.lineNumber !== "number" || !Number.isFinite(s.lineNumber) || s.lineNumber < 1) {
      return;
    }
    const line = Math.min(Math.round(s.lineNumber), maxLine);
    if (!indicesByLine.has(line)) indicesByLine.set(line, []);
    indicesByLine.get(line)!.push(i);
  });

  const regions: (SourceRegion | null)[] = segments.map(() => null);

  for (const [line, indices] of indicesByLine) {
    const totalLen = indices.reduce((sum, i) => sum + Math.max(segments[i].text.length, 1), 0) || 1;
    const top = TOP_MARGIN + (line - 1) * lineHeight;
    let cursor = LEFT_MARGIN;
    for (const i of indices) {
      const len = Math.max(segments[i].text.length, 1);
      const width = (len / totalLen) * usableWidth;
      regions[i] = { bbox: [cursor, top, width, lineHeight * LINE_FILL_RATIO] };
      cursor += width;
    }
  }

  return regions;
}
