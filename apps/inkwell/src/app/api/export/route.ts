import { stat } from "fs/promises";
import path from "path";
import { PassThrough } from "stream";
import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import {
  handwritingExamplesRepo,
  handwritingProfileRepo,
  notesRepo,
} from "@/lib/db";

// Data export (FR-1.x / AC-18), scoped to what this walking skeleton
// actually has - no folders/tags/accounts yet (see
// claude/08-walking-skeleton-scope.md), so this is just "everything about
// your notes" rather than a full account export. Bundles:
//   - notes.json: every note's transcription (both the AI's original output
//     and your corrected version), status, and dates, plus the handwriting
//     profile/examples the learning loop has built up.
//   - images/: every original photo still on disk, so a full copy of both
//     the source and the transcription exists outside the app's own
//     database and public/uploads/ folder (neither of which is backed up or
//     synced anywhere else right now).
export async function GET() {
  const notes = notesRepo.listAll();
  const examples = handwritingExamplesRepo.listAll();
  const profile = handwritingProfileRepo.get();

  const exportData = {
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      status: note.status,
      imageFile: note.image_path ? path.basename(note.image_path) : null,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      transcription: note.segmentsCurrent.map((s) => s.text).join("\n\n"),
      segmentsCurrent: note.segmentsCurrent,
      segmentsOriginalAi: note.segmentsAi,
    })),
    handwritingProfile: profile,
    handwritingExamples: examples,
  };

  // archiver v8's API is class-based (ZipArchive), not the older callable
  // archiver("zip", opts) factory some docs/examples still show.
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const passthrough = new PassThrough();
  archive.on("error", (err: Error) => passthrough.destroy(err));
  archive.pipe(passthrough);

  archive.append(JSON.stringify(exportData, null, 2), { name: "notes.json" });

  for (const note of notes) {
    if (!note.image_path) continue;
    const absolutePath = path.join(process.cwd(), "public", note.image_path);
    try {
      await stat(absolutePath);
      archive.file(absolutePath, { name: `images/${path.basename(note.image_path)}` });
    } catch {
      // Original no longer on disk (e.g. manually removed) - the JSON export
      // still has the full transcription, so skip rather than fail the export.
    }
  }

  archive.finalize();

  // Route handlers need a Web ReadableStream body; adapt the Node PassThrough.
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      passthrough.on("end", () => controller.close());
      passthrough.on("error", (err) => controller.error(err));
    },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="inkwell-export-${dateStamp}.zip"`,
    },
  });
}
