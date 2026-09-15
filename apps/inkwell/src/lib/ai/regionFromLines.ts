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
// UPDATE: real-photo testing (with a synthetic multi-line page, since no
// actual handwritten photo was available) found line-counting itself works
// well - the model correctly grouped multi-segment lines and ordered them
// top to bottom. But the first version of this function assumed handwriting
// fills nearly the whole page (5%-95% top to bottom) and divided that
// evenly by line count. For a short page - a few lines with blank space
// below, which is a completely ordinary way to write a note - that put
// later lines' highlights well past where the real writing actually ends.
// Fixed by asking the model for one additional *page-level* (not
// per-segment) judgment: roughly where the handwritten block starts and
// ends vertically. Still just one holistic call, not per-segment
// coordinate regression - the failure mode this file was already designed
// to avoid - so it's used only as the vertical range line bands are spread
// across, with a full-page fallback when it's missing or nonsensical.
//
// Still unverified against a real handwritten photo (no live API key with
// an actual photo of handwriting in this sandbox) - see the Asana Discovery
// Item this shipped alongside.

const DEFAULT_CONTENT_TOP = 0.05;
const DEFAULT_CONTENT_BOTTOM = 0.95;
const MIN_CONTENT_SPAN = 0.05; // guards against a degenerate top≈bottom from the model
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

export interface ContentArea {
  /** 0-1 fraction of the full page height where the handwritten block starts. */
  top: number;
  /** 0-1 fraction of the full page height where the handwritten block ends. */
  bottom: number;
}

function resolveContentArea(contentArea: ContentArea | null | undefined): {
  top: number;
  bottom: number;
} {
  const top = contentArea?.top;
  const bottom = contentArea?.bottom;
  const valid =
    typeof top === "number" &&
    typeof bottom === "number" &&
    Number.isFinite(top) &&
    Number.isFinite(bottom) &&
    top >= 0 &&
    bottom <= 1 &&
    bottom - top >= MIN_CONTENT_SPAN;
  return valid ? { top, bottom } : { top: DEFAULT_CONTENT_TOP, bottom: DEFAULT_CONTENT_BOTTOM };
}

/**
 * Computes one SourceRegion (or null) per input segment, in the same order,
 * from each segment's reported line number and text length, spread across
 * the given page-level content area (falling back to a near-full-page
 * default when omitted or nonsensical).
 */
export function computeLineBasedRegions(
  segments: LineTaggedSegment[],
  contentArea?: ContentArea | null
): (SourceRegion | null)[] {
  const validLineNumbers = segments
    .map((s) => s.lineNumber)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 1);

  if (validLineNumbers.length === 0) {
    return segments.map(() => null);
  }

  const { top: TOP_MARGIN, bottom: BOTTOM_FRACTION } = resolveContentArea(contentArea);
  const maxLine = Math.max(...validLineNumbers);
  const usableHeight = BOTTOM_FRACTION - TOP_MARGIN;
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
