import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type { TranscriptSegment } from "./ai/types";
import { CONFIDENCE_THRESHOLD } from "./config";

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
// SQLite doesn't enforce foreign keys unless told to per-connection - without
// this, the `ON DELETE CASCADE` below on handwriting_examples is silently a
// no-op and deleting a note would leave its examples orphaned.
db.pragma("foreign_keys = ON");

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

  -- Folders/tags, narrowed from 04-data-model.md: flat (no parent_folder_id
  -- nesting) and manual-only for folders (no AI folder-suggestion flow) -
  -- tags do get an AI-suggestion pass (generateTags), folders don't, per the
  -- scoping decision for this feature. No user_id on any of these - still
  -- single implicit user.
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,  -- lowercased/trimmed, for AI/user dedup (FR-7.6)
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence REAL,          -- null for user-added tags
    source TEXT NOT NULL,     -- 'user' | 'ai'
    created_at TEXT NOT NULL,
    PRIMARY KEY (note_id, tag_id)
  );
`);

// notes.folder_id was added after the original table shape shipped - ALTER
// TABLE ADD COLUMN, guarded so it's a no-op (not an error) on a database
// that already has it. `ON DELETE SET NULL` isn't expressible on an added
// column via ALTER TABLE in SQLite, so that behavior (a deleted folder
// clears folder_id rather than deleting the note - 04-data-model.md's
// "safety net, not the primary UX path") is enforced in foldersRepo.delete
// below instead of at the schema level.
const noteColumns = db.prepare(`PRAGMA table_info(notes)`).all() as { name: string }[];
if (!noteColumns.some((c) => c.name === "folder_id")) {
  db.exec(`ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES folders(id)`);
}

export interface NoteRow {
  id: string;
  title: string | null;
  image_path: string;
  status: "uploaded" | "transcribing" | "ready_for_review" | "reviewed" | "error";
  error_message: string | null;
  segments_ai: string;
  segments_current: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteTagView {
  id: string;
  name: string;
  source: "user" | "ai";
  confidence: number | null;
}

export interface Note extends Omit<NoteRow, "segments_ai" | "segments_current"> {
  segmentsAi: TranscriptSegment[];
  segmentsCurrent: TranscriptSegment[];
  tags: NoteTagView[];
}

// review-required is recomputed from each segment's stored raw confidence
// against the *current* CONFIDENCE_THRESHOLD every time a note is read,
// rather than trusting whatever was baked in at transcribe/retry time. This
// is what AC-5 actually requires: changing the threshold in config and
// re-rendering a previously-transcribed note must update its flags without
// re-transcribing. (A provider still sets an initial value on the way in;
// it's simply overwritten here.)
function applyReviewRequired(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map((s) => ({ ...s, reviewRequired: s.confidence < CONFIDENCE_THRESHOLD }));
}

function getTagsForNote(noteId: string): NoteTagView[] {
  return db
    .prepare(
      `SELECT tags.id as id, tags.name as name, note_tags.source as source, note_tags.confidence as confidence
       FROM note_tags JOIN tags ON tags.id = note_tags.tag_id
       WHERE note_tags.note_id = ?
       ORDER BY tags.name ASC`
    )
    .all(noteId) as NoteTagView[];
}

function rowToNote(row: NoteRow): Note {
  return {
    ...row,
    segmentsAi: applyReviewRequired(JSON.parse(row.segments_ai)),
    segmentsCurrent: applyReviewRequired(JSON.parse(row.segments_current)),
    tags: getTagsForNote(row.id),
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

  // placeholderTitle is only ever applied via COALESCE, so a title the user
  // already set (or edited) is never clobbered by upload/retry - see
  // titleGen.ts.
  setTranscribed(
    id: string,
    segments: TranscriptSegment[],
    updatedAt: string,
    placeholderTitle: string | null = null
  ): void {
    const json = JSON.stringify(segments);
    db.prepare(
      `UPDATE notes SET status = 'ready_for_review', segments_ai = ?, segments_current = ?, title = COALESCE(title, ?), updated_at = ?
       WHERE id = ?`
    ).run(json, json, placeholderTitle, updatedAt, id);
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

  // folderId: null clears the folder (moves the note to "no folder").
  setFolder(id: string, folderId: string | null, updatedAt: string): void {
    db.prepare(`UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?`).run(
      folderId,
      updatedAt,
      id
    );
  },

  getById(id: string): Note | undefined {
    const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
    return row ? rowToNote(row) : undefined;
  },

  // Deletes the note row and (via ON DELETE CASCADE) its handwriting_examples.
  // Does not touch the uploaded image file - callers are responsible for that,
  // since this module doesn't otherwise deal in filesystem paths.
  delete(id: string): void {
    db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  },

  // folderId: undefined = no filter (all notes), null = only unfiled notes,
  // a string = only notes in that folder.
  listAll(query?: string, folderId?: string | null): Note[] {
    const rows =
      folderId === undefined
        ? (db.prepare(`SELECT * FROM notes ORDER BY created_at DESC`).all() as NoteRow[])
        : (db
            .prepare(`SELECT * FROM notes WHERE folder_id IS ? ORDER BY created_at DESC`)
            .all(folderId) as NoteRow[]);
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

export interface FolderRow {
  id: string;
  name: string;
  created_at: string;
}

export const foldersRepo = {
  create(input: { id: string; name: string; createdAt: string }): void {
    db.prepare(`INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)`).run(
      input.id,
      input.name,
      input.createdAt
    );
  },

  listAll(): FolderRow[] {
    return db.prepare(`SELECT * FROM folders ORDER BY name ASC`).all() as FolderRow[];
  },

  getById(id: string): FolderRow | undefined {
    return db.prepare(`SELECT * FROM folders WHERE id = ?`).get(id) as FolderRow | undefined;
  },

  // Notes in this folder are reassigned to "no folder" first (04-data-model.md:
  // "the application layer [must] first reassign or null out notes.folder_id" -
  // deleting a folder must never delete the notes in it), then the folder row
  // itself is removed. Both statements run as one transaction so a crash
  // between them can't leave notes pointing at a folder_id that no longer
  // exists.
  delete(id: string): void {
    const tx = db.transaction((folderId: string) => {
      db.prepare(`UPDATE notes SET folder_id = NULL WHERE folder_id = ?`).run(folderId);
      db.prepare(`DELETE FROM folders WHERE id = ?`).run(folderId);
    });
    tx(id);
  },
};

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export const tagsRepo = {
  listAll(): { id: string; name: string }[] {
    return db.prepare(`SELECT id, name FROM tags ORDER BY name ASC`).all() as {
      id: string;
      name: string;
    }[];
  },

  // Case-insensitive find-or-create by normalized name (FR-7.6 / AC-9's
  // "reuse the existing tag rather than a near-duplicate being created"),
  // so "D&D" and "d&d" resolve to the same row and the first-ever spelling
  // wins for display.
  findOrCreate(name: string, createdAt: string): { id: string; name: string } {
    const normalized = normalizeTagName(name);
    const existing = db
      .prepare(`SELECT id, name FROM tags WHERE normalized_name = ?`)
      .get(normalized) as { id: string; name: string } | undefined;
    if (existing) return existing;

    const id = randomUUID();
    db.prepare(
      `INSERT INTO tags (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)`
    ).run(id, name.trim(), normalized, createdAt);
    return { id, name: name.trim() };
  },
};

export const noteTagsRepo = {
  // Replaces the note's full tag set. Used both for the AI's initial
  // suggestions (source: 'ai') at upload time and for the user's edits from
  // the review screen (source: 'user') - see notes/[id]/route.ts PATCH.
  // Replacing rather than diffing is deliberate and simple for this phase:
  // the review screen always saves the complete current tag list, the same
  // pattern as segments_current.
  setForNote(
    noteId: string,
    tags: { tagId: string; source: "user" | "ai"; confidence: number | null }[],
    createdAt: string
  ): void {
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM note_tags WHERE note_id = ?`).run(noteId);
      const insert = db.prepare(
        `INSERT INTO note_tags (note_id, tag_id, confidence, source, created_at)
         VALUES (@noteId, @tagId, @confidence, @source, @createdAt)`
      );
      for (const t of tags) {
        insert.run({
          noteId,
          tagId: t.tagId,
          confidence: t.confidence,
          source: t.source,
          createdAt,
        });
      }
    });
    tx();
  },

  // Whether this note has ever had any tags recorded - used to gate the
  // one-time AI tag suggestion the same way titleGen.ts gates the
  // placeholder title, so a later retry doesn't silently re-add a tag the
  // user deliberately removed (AC-9: "does not silently reappear").
  hasAnyForNote(noteId: string): boolean {
    const row = db.prepare(`SELECT 1 FROM note_tags WHERE note_id = ? LIMIT 1`).get(noteId);
    return Boolean(row);
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
