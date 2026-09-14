import sharp from "sharp";

// Prepares an uploaded photo for the vision model. Two real problems this
// fixes (found by inspecting an actual failed transcription, not guessed):
//
// 1. Phone photos carry an EXIF orientation tag rather than storing pixels
//    upright; a model reading raw pixel data can see a sideways/upside-down
//    page. `.rotate()` with no args bakes the EXIF orientation into the
//    pixels and strips the tag.
// 2. Claude's vision input has a resolution ceiling depending on model tier
//    (2576px long edge for the "high-resolution" tier, 1568px otherwise -
//    see docs/inkwell/ and platform.claude.com/docs/en/build-with-claude/vision).
//    A model call that doesn't pre-resize gets its image silently downscaled
//    by the API instead, which for a full, uncropped 12MP+ photo of a page of
//    small cursive can blur individual letters into illegibility - the model
//    then pattern-matches plausible-sounding words instead of reading real
//    ones. Pre-resizing ourselves with a high-quality resampler, and only
//    ever downscaling (never upscaling a smaller image), gives the model the
//    most legible version that fits the ceiling.
const MAX_LONG_EDGE = 2576;
const JPEG_QUALITY = 92; // high, to avoid the compression artifacts the vision docs warn hurt OCR accuracy

export async function prepareImageForVision(
  buffer: Buffer
): Promise<{ buffer: Buffer; mediaType: "image/jpeg" }> {
  const image = sharp(buffer).rotate(); // auto-orient from EXIF, then strip it
  const metadata = await image.metadata();
  const longEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);

  const resized =
    longEdge > MAX_LONG_EDGE
      ? image.resize({
          width: MAX_LONG_EDGE,
          height: MAX_LONG_EDGE,
          fit: "inside",
          withoutEnlargement: true,
          kernel: "lanczos3",
        })
      : image;

  const outputBuffer = await resized.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  return { buffer: outputBuffer, mediaType: "image/jpeg" };
}
