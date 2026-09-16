// Image-region highlighting, attempt #4. History (see claude/09-walking-
// skeleton-architecture.md's feature log for the full narrative):
//   - PR #9-#11: asked the model for a physical line number + hand-computed
//     geometry from it. Inaccurate (a "line number" doesn't map cleanly onto
//     variable handwriting line heights) and, worse, PR #25 found that even
//     just *having* a lineNumber field in the schema was priming the model to
//     chunk transcription segments at physical line breaks instead of natural
//     phrase/sentence boundaries - a real transcription-quality regression.
//   - PR #22 / #24: the whole feature was ripped out ("too inconsistent to be
//     helpful") rather than iterated on again blind.
//
// This attempt uses grid-overlay ("set-of-mark") prompting instead: bake a
// labeled reference grid onto the image, and ask the model which already-
// visible, labeled cell(s) a segment touches. That turns an open-ended
// numeric-regression task (raw coordinates, or a line number requiring
// geometry the model can't see) into closed-set classification against
// something the model can literally see in front of it - a much better fit
// for how vision-language models actually work.
//
// Explicit cost constraint from the user: this must not increase the app's
// per-transcription token/API cost. That rules out a second grid-only image
// alongside the transcription image, and rules out iterative crop-and-zoom
// (extra vision calls). So the grid is composited directly onto the *same*
// single image already sent for transcription - the token delta is just the
// few extra `gridCells` strings per segment in the response, comparable to
// the old lineNumber/contentArea fields this replaces.
//
// Trade-off accepted knowingly: thin gridlines end up crossing real
// handwriting. Mitigated by keeping lines thin and semi-transparent, and by
// confining every text label (column letters, row numbers) to a blank margin
// added around the photo, so no label ever sits on top of the writing.
//
// GRID_COLS/GRID_ROWS are the main knob to tune if real-world accuracy needs
// adjusting later: more cells = finer-grained highlights but a harder
// per-cell classification call for the model; fewer cells = coarser but more
// reliable.
import sharp from "sharp";
import type { SourceRegion } from "./types";

export const GRID_COLS = 6;
export const GRID_ROWS = 12;

const GRID_COLOR = "#ff2fd0"; // bright magenta - visually distinct from ink

function colLetter(col: number): string {
  return String.fromCharCode("A".charCodeAt(0) + col);
}

/** e.g. cellId(2, 3) -> "C4" (columns A.. left-to-right, rows 1.. top-to-bottom). */
export function cellId(col: number, row: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function parseCellId(id: string): { col: number; row: number } | null {
  const match = /^\s*([A-Za-z])\s*(\d+)\s*$/.exec(id);
  if (!match) return null;
  const col = match[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  const row = Number(match[2]) - 1;
  if (col < 0 || col >= GRID_COLS) return null;
  if (!Number.isInteger(row) || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

/** Fractional [x, y, w, h] for one cell - deliberately independent of pixel
 *  dimensions, so this needs no knowledge of the image's actual size. */
function cellRect(col: number, row: number): [number, number, number, number] {
  return [col / GRID_COLS, row / GRID_ROWS, 1 / GRID_COLS, 1 / GRID_ROWS];
}

// Parses the model's reported grid cells for one segment into a single
// enveloping SourceRegion. Invalid ids are skipped rather than rejected
// outright (a partially-malformed response shouldn't lose the whole region),
// and if nothing valid is left, returns undefined - no highlight beats a
// wrong one.
export function regionFromCells(cellIds: string[] | undefined): SourceRegion | undefined {
  if (!cellIds || cellIds.length === 0) return undefined;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let matched = 0;

  for (const rawId of cellIds) {
    const parsed = parseCellId(rawId);
    if (!parsed) continue;
    const [x, y, w, h] = cellRect(parsed.col, parsed.row);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + w);
    bottom = Math.max(bottom, y + h);
    matched++;
  }

  if (matched === 0) return undefined;
  return { bbox: [left, top, right - left, bottom - top] };
}

// Composites a labeled reference grid onto the image before it's sent for
// transcription. Defensive: if metadata can't be read, returns the original
// buffer unmodified rather than failing transcription over a cosmetic step.
export async function overlayGrid(buffer: Buffer): Promise<Buffer> {
  const base = sharp(buffer);
  const metadata = await base.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) return buffer;

  const marginTop = Math.round(Math.max(28, Math.min(56, height * 0.045)));
  const marginLeft = Math.round(Math.max(28, Math.min(56, width * 0.045)));
  const fontSize = Math.round(Math.max(14, Math.min(28, marginTop * 0.5)));

  const canvasWidth = width + marginLeft;
  const canvasHeight = height + marginTop;

  const lines: string[] = [];
  for (let col = 0; col <= GRID_COLS; col++) {
    const x = marginLeft + (col / GRID_COLS) * width;
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${canvasHeight}" stroke="${GRID_COLOR}" stroke-width="1.5" stroke-opacity="0.4" />`
    );
  }
  for (let row = 0; row <= GRID_ROWS; row++) {
    const y = marginTop + (row / GRID_ROWS) * height;
    lines.push(
      `<line x1="0" y1="${y}" x2="${canvasWidth}" y2="${y}" stroke="${GRID_COLOR}" stroke-width="1.5" stroke-opacity="0.4" />`
    );
  }

  const colLabels: string[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    const x = marginLeft + (col + 0.5) * (width / GRID_COLS);
    colLabels.push(
      `<text x="${x}" y="${marginTop * 0.68}" font-size="${fontSize}" font-family="monospace" ` +
        `font-weight="bold" fill="${GRID_COLOR}" text-anchor="middle">${colLetter(col)}</text>`
    );
  }

  const rowLabels: string[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const y = marginTop + (row + 0.5) * (height / GRID_ROWS);
    rowLabels.push(
      `<text x="${marginLeft * 0.5}" y="${y}" font-size="${fontSize}" font-family="monospace" ` +
        `font-weight="bold" fill="${GRID_COLOR}" text-anchor="middle" dominant-baseline="middle">${row + 1}</text>`
    );
  }

  // NOTE: deliberately no full-canvas background rect here. This SVG is
  // composited (default blend mode "over") on top of the already-extended
  // base image below, which already has a real white margin AND the actual
  // photo in the rest of the canvas - an opaque rect spanning the whole SVG
  // canvas (as an earlier version of this file had) paints over that photo
  // with solid white, silently sending the model a blank grid instead of the
  // page. Found 2026-09-16: transcription had been quietly returning zero
  // segments for every real (non-mock) upload since this file first shipped
  // in PR #26, because of exactly that - see the feature log entry for the
  // full story of how this got caught. Everything below is transparent
  // except the lines/text/border themselves, so the photo shows through.
  const svg = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${marginLeft}" y="${marginTop}" width="${width}" height="${height}"
            fill="none" stroke="${GRID_COLOR}" stroke-width="2" stroke-opacity="0.6" />
      ${lines.join("\n")}
      ${colLabels.join("\n")}
      ${rowLabels.join("\n")}
    </svg>
  `;

  const extended = sharp(buffer).extend({
    top: marginTop,
    left: marginLeft,
    right: 0,
    bottom: 0,
    background: { r: 255, g: 255, b: 255 },
  });

  return extended
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
