import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { getHandwritingContext } from "@/lib/handwritingProfile";
import { CONFIDENCE_THRESHOLD } from "@/lib/config";
import { derivePlaceholderTitle } from "@/lib/titleGen";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Synchronous processing for this phase (per claude/08-walking-skeleton-scope.md):
// the upload request itself runs transcribe() and waits for it, rather than
// enqueuing an async pipeline stage. This is the one deliberate deviation
// from FR-2.5/FR-17.1 ("upload gives immediate feedback, doesn't block on AI")
// - acceptable while the whole point is validating the AI loop end-to-end
// with a human at the keyboard; revisit when this grows toward the full
// async pipeline in docs/inkwell/02-architecture.md §8.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Use JPEG, PNG, or WebP.` },
      { status: 400 }
    );
  }

  const id = randomUUID();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const relativePath = `uploads/${id}.${ext}`;
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  const now = new Date().toISOString();
  notesRepo.create({ id, title: null, imagePath: relativePath, createdAt: now });

  try {
    const provider = getAIProvider();
    const result = await provider.transcribe({
      imagePath: relativePath,
      handwritingContext: getHandwritingContext(),
      confidenceThreshold: CONFIDENCE_THRESHOLD,
    });
    notesRepo.setTranscribed(
      id,
      result.segments,
      new Date().toISOString(),
      derivePlaceholderTitle(result.segments)
    );
  } catch (err) {
    // A failure here does not lose the uploaded original (FR-3.8/FR-13.2) -
    // the image is already saved and the note is left in a recoverable
    // 'error' state rather than discarded.
    const message = err instanceof Error ? err.message : "Transcription failed.";
    notesRepo.setError(id, message, new Date().toISOString());
    return NextResponse.json({ id, error: message }, { status: 502 });
  }

  return NextResponse.json({ id }, { status: 201 });
}
