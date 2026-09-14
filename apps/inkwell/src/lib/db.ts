import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { TranscriptSegment } from "./ai/types";

// SQLite for this phase, schema narrowed from the Phase 4 data-model doc to
// what a single-page, single-user walking skeleton needs. Field names and
// shapes intentionally mirror the full `notes` / `handwriting_examples` /
// `handwriting_profiles` tables in docs/inkwell/04-data-model.md so that a
// later move to Postgres is a swap of this file, not a rewrite of callers -
// see claude/08-walking-skeleton-scope.md.

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "inkwell.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    image_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | transcribing | ready_for_review | reviewed | error
    error_message TEXT,
    segments_ai TEXT NOT NULL,      -- JSON TranscriptSegment[], immutable AI output (transcription_raw_ai)
    segments_current TEXT NOT NULL, -- JSON TranscriptSegment[] with edited text (authoritative transcription)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS handwriting_examples (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL,
    ai_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    classification TEXT NOT NULL,
    learning_weight REAL NOT NULL,
    original_confidence REAL,
    created_at TEXT NOT NULL
  );

  -- Singleton row: single implicit user for this phase (no auth yet).
  CREATE TABLE IF NOT EXISTS handwriting_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL DEFAULT 1,
    vocabulary TEXT NOT NULL DEFAULT '[]',            -- JSON [{ term, frequency }]
    correction_patterns TEXT NOT NULL DEFAULT '[]',   -- JSON [{ fromPattern, toPattern, occurrences, lastConfirmedAt }]
    updated_at TEXT NOT NULL
  );
`);

export interface NoteRow {
  id: string;
  title: string | null;
  image_path: string;
  status: "uploaded" | "transcribing" | "ready_for_review" | "reviewed" | "error";
  error_message: string | null;
  segments_ai: string;
  segments_current: string;
  created_at: string;
  updated_at: string;
}

export interface Note extends Omit<NoteRow, "segments_ai" | "segments_current"> {
  segmentsAi: TranscriptSegment[];
  segmentsCurrent: TranscriptSegment[];
}

function rowToNote(row: NoteRow): Note {
  return {
    ...row,
    segmentsAi: JSON.parse(row.segments_ai),
    segmentsCurrent: JSON.parse(row.segments_current),
  };
}

export const notesRepo = {
  create(input: {
    id: string;
    title: string | null;
    imagePath: string;
    createdAt: string;
  }): void {
    db.prepare(
      `INSERT INTO notes (id, title, image_path, status, segments_ai, segments_current, created_at, updated_at)
       VALUES (?, ?, ?, 'uploaded', '[]', '[]', ?, ?)`
    ).run(input.id, input.title, input.imagePath, input.createdAt, input.createdAt);
  },

  setTranscribed(id: string, segments: TranscriptSegment[], updatedAt: string): void {
    const json = JSON.stringify(segments);
    db.prepare(
      `UPDATE notes SET status = 'ready_for_review', segments_ai = ?, segments_current = ?, updated_at = ?
       WHERE id = ?`
    ).run(json, json, updatedAt, id);
  },

  setError(id: string, message: string, updatedAt: string): void {
    db.prepare(`UPDATE notes SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?`).run(
      message,
      updatedAt,
      id
    );
  },

  setReviewed(
    id: string,
    segments: TranscriptSegment[],
    title: string | null,
    updatedAt: string
  ): void {
    db.prepare(
      `UPDATE notes SET status = 'reviewed', segments_current = ?, title = COALESCE(?, title), updated_at = ?
       WHERE id = ?`
    ).run(JSON.stringify(segments), title, updatedAt, id);
  },

  getById(id: string): Note | undefined {
    const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
    return row ? rowToNote(row) : undefined;
  },

  listAll(query?: string): Note[] {
    const rows = db
      .prepare(`SELECT * FROM notes ORDER BY created_at DESC`)
      .all() as NoteRow[];
    const notes = rows.map(rowToNote);
    if (!query) return notes;

    // Naive substring search over the current transcription text and title -
    // per claude/08-walking-skeleton-scope.md, hybrid/semantic search is
    // deferred; this just confirms notes are durably saved and retrievable.
    const q = query.toLowerCase();
    return notes.filter((n) => {
      const haystack = [n.title ?? "", ...n.segmentsCurrent.map((s) => s.text)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  },
};

export const handwritingExamplesRepo = {
  create(input: {
    id: string;
    noteId: string;
    segmentId: string;
    aiText: string;
    correctedText: string;
    classification: string;
    learningWeight: number;
    originalConfidence: number | null;
    createdAt: string;
  }): void {
    db.prepare(
      `INSERT INTO handwriting_examples
        (id, note_id, segment_id, ai_text, corrected_text, classification, learning_weight, original_confidence, created_at)
       VALUES (@id, @noteId, @segmentId, @aiText, @correctedText, @classification, @learningWeight, @originalConfidence, @createdAt)`
    ).run(input);
  },

  listAll(): {
    id: string;
    note_id: string;
    segment_id: string;
    ai_text: string;
    corrected_text: string;
    classification: string;
    learning_weight: number;
    original_confidence: number | null;
    created_at: string;
  }[] {
    return db.prepare(`SELECT * FROM handwriting_examples ORDER BY created_at ASC`).all() as ReturnType<
      typeof handwritingExamplesRepo.listAll
    >;
  },
};

export interface VocabularyEntry {
  term: string;
  frequency: number;
}

export interface CorrectionPattern {
  fromPattern: string;
  toPattern: string;
  occurrences: number;
  lastConfirmedAt: string;
}

export interface HandwritingProfileRow {
  version: number;
  vocabulary: VocabularyEntry[];
  correctionPatterns: CorrectionPattern[];
  updatedAt: string;
}

export const handwritingProfileRepo = {
  get(): HandwritingProfileRow {
    const row = db.prepare(`SELECT * FROM handwriting_profile WHERE id = 1`).get() as
      | {
          version: number;
          vocabulary: string;
          correction_patterns: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      return { version: 0, vocabulary: [], correctionPatterns: [], updatedAt: "" };
    }
    return {
      version: row.version,
      vocabulary: JSON.parse(row.vocabulary),
      correctionPatterns: JSON.parse(row.correction_patterns),
      updatedAt: row.updated_at,
    };
  },

  upsert(profile: {
    vocabulary: VocabularyEntry[];
    correctionPatterns: CorrectionPattern[];
    updatedAt: string;
  }): void {
    db.prepare(
      `INSERT INTO handwriting_profile (id, version, vocabulary, correction_patterns, updated_at)
       VALUES (1, 1, @vocabulary, @correctionPatterns, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         version = version + 1,
         vocabulary = @vocabulary,
         correction_patterns = @correctionPatterns,
         updated_at = @updatedAt`
    ).run({
      vocabulary: JSON.stringify(profile.vocabulary),
      correctionPatterns: JSON.stringify(profile.correctionPatterns),
      updatedAt: profile.updatedAt,
    });
  },
};

export default db;
