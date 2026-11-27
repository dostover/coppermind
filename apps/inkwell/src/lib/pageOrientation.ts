import { readFile, rename, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { AIProvider } from "./ai/types";

// Turns a stored page photo upright before it's transcribed, and rewrites the
// file so the review screen, the close-up and the AI all see the same
// upright picture. Notebook pages are portrait, so only a photo that is still
// wider than tall after applying its EXIF orientation gets checked: the
// light model is shown a small copy and says which way up it is (one cheap
// call, only for sideways photos). Portrait photos are left untouched.
//
// Without this, a sideways page was transcribed sideways: the reference grid
// (gridOverlay.ts) then labelled the wrong rows, so the close-up zoomed into
// the wrong part of the page, and the page showed sideways in Inkwell.
//
// Rewriting re-encodes the JPEG at high quality; the photo is otherwise the
// same one the user took. Best-effort: callers log a failure and transcribe
// the photo as it is.

const THUMB_LONG_EDGE = 1024;
const JPEG_QUALITY = 95;

/** True when the photo was rotated and rewritten. */
export async function makeStoredPageUpright(imagePath: string, provider: AIProvider): Promise<boolean> {
  if (!imagePath) return false;
  const absolutePath = path.join(process.cwd(), "public", imagePath);
  const raw = await readFile(absolutePath);

  const meta = await sharp(raw).metadata();
  if (!meta.width || !meta.height) return false;
  // EXIF orientations 5-8 swap width and height when displayed.
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;
  if (width <= height) return false;

  const thumb = await sharp(raw)
    .rotate()
    .resize({ width: THUMB_LONG_EDGE, height: THUMB_LONG_EDGE, fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer();
  const { rotation } = await provider.detectPageRotation({ image: thumb });
  if (rotation === 0) return false;

  // .rotate() bakes in the EXIF orientation (and drops the tag); the second
  // turns the page upright. Two separate pipelines because sharp applies only
  // one rotate() per pipeline.
  const oriented = await sharp(raw).rotate().toBuffer();
  const upright = await sharp(oriented).rotate(rotation).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  const tmp = `${absolutePath}.upright-tmp`;
  await writeFile(tmp, upright);
  await rename(tmp, absolutePath);
  return true;
}
