import { createHash } from "crypto";
import { notesRepo, searchIndexRepo, type Note } from "./db";
import { getEmbeddingProvider } from "./embeddings";
import type { TranscriptSegment } from "./ai/types";

// Builds a note's search index: split its current (user-corrected)
// transcription into passage-sized chunks, embed each, and store vectors +
// keyword rows via searchIndexRepo. Called from the index_note job stage
// (jobs.ts) whenever a note's content changes, and once at startup for any
// note never indexed (or indexed by a different embedding model).

// Target passage size. Small enough that a retrieved chunk is about one
// thing (and cheap to hand to Claude as an answer excerpt), big enough to
// carry context - one sermon point with its sub-points, or a paragraph or
// two of a story.
const CHUNK_TARGET_WORDS = 120;
// A single line longer than this is split on sentence boundaries.
const CHUNK_MAX_WORDS = 220;

export interface NoteChunk {
  chunkIndex: number;
  pageNumber: number;
  text: string;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

// Lines exactly as the review screen shows them (startsNewBlock starts a
// new line; other segments continue it). Crossed-out text is left out of
// the index - the writer struck it, so a search shouldn't surface it.
function pageLines(segments: TranscriptSegment[]): string[] {
  const lines: string[] = [];
  segments.forEach((s, i) => {
    if (i === 0 || s.startsNewBlock || lines.length === 0) {
      lines.push(s.crossedOut ? "" : s.text);
    } else if (!s.crossedOut) {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${s.text}`.trim();
    }
  });
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function splitLongLine(line: string): string[] {
  if (wordCount(line) <= CHUNK_MAX_WORDS) return [line];
  const sentences = line.match(/[^.!?]+[.!?]*\s*/g) ?? [line];
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && wordCount(current + sentence) > CHUNK_TARGET_WORDS) {
      parts.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Packs consecutive lines into ~CHUNK_TARGET_WORDS passages, never across a
// page boundary (so a citation can point at one page). Lines are joined
// with newlines, preserving the note's own structure in what Claude sees.
export function chunkNote(note: Note): NoteChunk[] {
  const chunks: NoteChunk[] = [];
  for (const page of note.pages) {
    if (page.status !== "ready_for_review" || page.transcriptionRemoved) continue;
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) chunks.push({ chunkIndex: chunks.length, pageNumber: page.page_number, text: buffer.join("\n") });
      buffer = [];
    };
    for (const line of pageLines(page.segmentsCurrent).flatMap(splitLongLine)) {
      if (buffer.length && wordCount([...buffer, line].join(" ")) > CHUNK_TARGET_WORDS) flush();
      buffer.push(line);
    }
    flush();
  }
  return chunks;
}

// What actually gets embedded: the passage prefixed with the note's title,
// so a chunk from the middle of "Rilldale Chapter 13" still carries that
// context into its vector. The stored/displayed chunk text stays unprefixed.
function embeddingInput(note: Note, chunk: NoteChunk): string {
  return note.title ? `${note.title}\n\n${chunk.text}` : chunk.text;
}

function hashContent(note: Note, chunks: NoteChunk[], model: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ model, title: note.title ?? "", chunks: chunks.map((c) => [c.pageNumber, c.text]) }))
    .digest("hex");
}

/** Rebuilds one note's index if (and only if) its content or the embedding
 *  model changed since the last build. Returns what happened, for logging. */
export async function indexNote(noteId: string): Promise<"indexed" | "unchanged" | "missing"> {
  const note = notesRepo.getById(noteId);
  if (!note) return "missing"; // purged since the job was queued

  const provider = getEmbeddingProvider();
  const chunks = chunkNote(note);
  const contentHash = hashContent(note, chunks, provider.modelId);
  const state = searchIndexRepo.getState(noteId);
  if (state && state.content_hash === contentHash && state.embedding_model === provider.modelId) {
    return "unchanged";
  }

  const vectors = chunks.length
    ? await provider.embed(
        chunks.map((c) => embeddingInput(note, c)),
        "document"
      )
    : [];
  searchIndexRepo.replaceForNote(
    noteId,
    chunks.map((c, i) => ({ ...c, embedding: vectors[i] })),
    contentHash,
    provider.modelId,
    new Date().toISOString()
  );
  return "indexed";
}

/** Every non-trashed note whose stored index doesn't match its current
 *  content or the current embedding model - missing, stale, or left behind
 *  by a failed index job. Cheap: chunking and hashing only, no embedding
 *  calls. Run once at server start (jobs.ts) as a safety net under the
 *  explicit on-change triggers. */
export function findNotesNeedingIndex(): string[] {
  const model = getEmbeddingProvider().modelId;
  return notesRepo
    .listAll()
    .filter((note) => {
      const state = searchIndexRepo.getState(note.id);
      return !state || state.content_hash !== hashContent(note, chunkNote(note), model);
    })
    .map((note) => note.id);
}
