import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { createPagesForNote, prepareUploadedFiles, validateUploadedFiles } from "@/lib/pageUpload";

// Async processing (per claude/09-walking-skeleton-architecture.md's
// "Synchronous upload" note, superseding the walking-skeleton's original
// deliberate deviation from FR-2.5/FR-17.1): upload only saves the file(s)
// and enqueues processing_jobs row(s) for the note, then returns immediately
// - it never itself awaits any AI call, and (as of the PDF-upload fix below)
// never itself rasterizes a PDF either. The actual transcribe (batched
// across pages) + tag-suggestion work, and now PDF page rendering too, live
// in src/lib/jobs.ts, run by the in-process job runner started from
// src/instrumentation.ts. The note page polls GET /api/notes/[id] and shows
// a "still processing" state (per page) until each page's job completes.
//
// Multi-page notes (FR-2.4): one upload can carry several page images under
// the repeated "images" field, in the order the client sent them - that
// order becomes each page's page_number. All pages are grouped under one
// new note row from the start, matching the spec's "explicitly grouped into
// a single logical multi-page note." A PDF is accepted here too and expanded
// into one page per PDF page, at the position it was uploaded in, so a PDF
// and photographed pages can be mixed freely in one upload and still end up
// as one ordered sequence of note_pages rows - a PDF's pages just start out
// as placeholders (imagePath "") that fill in once their rasterize_pdf job
// runs, rather than existing immediately like a photographed page's does.
//
// All non-PDF-pending pages are enqueued as a single batch job
// (enqueueNoteTranscribeJob), not one job per page: one AI provider call
// covers every page, which avoids resending the system prompt/handwriting-
// context text once per page (see ai/types.ts's TranscribeBatchInput doc
// comment). When any PDF page is still pending rasterization, that batch job
// is deliberately *not* enqueued yet - jobs.ts's rasterize_pdf stage enqueues
// it itself, once every page of the note has a real image. Per-page retry
// after this point still uses individual single-image jobs - see
// /[id]/retry/route.ts.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  const invalid = validateUploadedFiles(files);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Expand every file into its final page slot(s) before creating anything,
  // so a bad PDF fails the whole request cleanly - see lib/pageUpload.ts.
  const prepared = await prepareUploadedFiles(files);
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: 400 });

  const noteId = randomUUID();
  const now = new Date().toISOString();
  notesRepo.create({ id: noteId, title: null, createdAt: now });
  await createPagesForNote(noteId, prepared.pages, 1, now);

  return NextResponse.json({ id: noteId }, { status: 201 });
}
