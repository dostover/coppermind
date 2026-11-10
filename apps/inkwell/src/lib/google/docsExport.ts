import { createHash } from "crypto";
import { notesRepo, type Note } from "@/lib/db";
import type { TranscriptSegment } from "@/lib/ai/types";
import { getValidAccessToken } from "./oauth";
import { withoutCrossedOut } from "@/lib/crossedOut";

// Exports a note to a Google Doc via the Docs API - the "Export/backup to
// Google Docs" feature. Deliberately separate from the existing zip export
// (/api/export): that one is a full local backup of everything; this is a
// per-note, human-readable copy living in the user's own Google Drive that
// they can read/share/print from any device, which a zip on disk can't do.
//
// Formatting is a best-effort mapping from TranscriptSegment onto Docs API
// concepts, not a full-fidelity reproduction of the review screen - see
// buildDocBody's comment for exactly what's simplified and why.

const DOCS_API_BASE = "https://docs.googleapis.com/v1/documents";

interface DocsCreateResponse {
  documentId: string;
}

// Only the parts of a Docs API document this module reads: each structural
// element's end index (to clear the body) and the text inside paragraphs,
// including paragraphs nested in tables / a table of contents.
interface DocsStructuralElement {
  endIndex: number;
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
  table?: { tableRows?: { tableCells?: { content?: DocsStructuralElement[] }[] }[] };
  tableOfContents?: { content?: DocsStructuralElement[] };
}

export interface DocsGetResponse {
  body?: { content?: DocsStructuralElement[] };
}

// Carries the HTTP status so callers can tell "this Doc no longer exists"
// (404) apart from a token, permission or network problem - only the former
// may ever be treated as "the Doc is gone".
export class DocsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DocsApiError";
  }
}

async function docsFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DOCS_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DocsApiError(`Google Docs API request failed (${res.status}): ${detail || res.statusText}`, res.status);
  }
  return (await res.json()) as T;
}

type StyleKind = "heading" | "bold" | "underline";

interface StyleRange {
  startIndex: number;
  endIndex: number;
  kind: StyleKind;
}

// Builds one flat text blob for the whole note (all its ready pages, in
// page order) plus the character ranges that need a style applied, so the
// caller can do exactly one insertText covering everything followed by
// non-overlapping style requests - see the "why one insertText" note in
// exportNoteToGoogleDoc.
//
// What's kept: the text and line breaks exactly as transcribed, and
// bold/underline emphasis from the handwriting. Crossed-out text is left out
// (2026-11-03, see lib/crossedOut.ts) - it only appears on the review screen. What's deliberately NOT applied (2026-09-30): the
// AI's per-line structureType. Handwritten notes carry their own markers in
// the text ("1.", "-", "†", "#"), so adding Docs heading styles or
// bullet/numbered-list formatting on top duplicated them ("1. 1. ...") and
// renumbered lines the writer had numbered themselves - the same reason the
// review screen renders every line as plain text. The one heading this
// export adds is its own "Page N" label on multi-page notes.

// Groups a page's flat segment list into lines exactly the way the review
// screen does (ReviewEditor.tsx's toLines): a new line starts wherever a
// segment has startsNewBlock set, otherwise it continues the previous one -
// e.g. a low-confidence word split out mid-sentence joins the same line
// rather than becoming its own one-word paragraph. Empty-text segments are
// dropped rather than starting an empty line.
function groupIntoLines(segments: TranscriptSegment[]): TranscriptSegment[][] {
  const lines: TranscriptSegment[][] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const last = lines[lines.length - 1];
    if (segment.startsNewBlock || !last) {
      lines.push([segment]);
    } else {
      last.push(segment);
    }
  }
  return lines;
}

function buildDocBody(note: Note): { text: string; styles: StyleRange[] } {
  let text = "";
  const styles: StyleRange[] = [];
  const multiPage = note.pages.length > 1;

  const pushStyled = (segment: string, kind?: StyleKind) => {
    const start = text.length;
    text += segment + "\n";
    if (kind) styles.push({ startIndex: start, endIndex: start + segment.length, kind });
  };

  for (const page of note.pages) {
    // A page that's still transcribing or failed has nothing reviewable yet
    // - export only what's actually ready, same rule the review screen uses
    // to decide what to render as editable content.
    if (page.status !== "ready_for_review") continue;

    if (multiPage) pushStyled(`Page ${page.page_number}`, "heading");

    for (const line of groupIntoLines(withoutCrossedOut(page.segmentsCurrent))) {
      line.forEach((segment, i) => {
        if (i > 0) text += " ";
        const segStart = text.length;
        text += segment.text;
        const segEnd = text.length;
        if (segment.emphasis === "bold_or_heavy") styles.push({ startIndex: segStart, endIndex: segEnd, kind: "bold" });
        if (segment.emphasis === "underline") styles.push({ startIndex: segStart, endIndex: segEnd, kind: "underline" });
      });
      text += "\n";
    }
  }

  return { text, styles };
}

// --- Reading a Doc back, and telling whether it was edited -----------------
//
// Once exported, a Doc is where the writer reworks the draft. Inkwell keeps
// a fingerprint of exactly what it last wrote (notes.google_doc_export_hash)
// and compares the Doc's current text against it: equal means the Doc is
// still Inkwell's copy of the draft; different means it was edited in
// Google Docs. Comparing text (not the Docs revision id, which Google says
// can change on its own) means formatting-only changes don't count, and a
// draft that was exported and never touched is never mistaken for rework.

function collectText(elements: DocsStructuralElement[] | undefined, out: string[]): void {
  for (const el of elements ?? []) {
    for (const part of el.paragraph?.elements ?? []) out.push(part.textRun?.content ?? "");
    for (const row of el.table?.tableRows ?? []) {
      for (const cell of row.tableCells ?? []) collectText(cell.content, out);
    }
    collectText(el.tableOfContents?.content, out);
  }
}

export function extractDocText(doc: DocsGetResponse): string {
  const out: string[] = [];
  collectText(doc.body?.content, out);
  return normalizeDocText(out.join(""));
}

// Whitespace-insensitive at the edges so the comparison only reacts to real
// edits: Docs line breaks (\u000b) become newlines, trailing spaces and runs
// of blank lines collapse, and the Doc's own trailing newline is dropped.
export function normalizeDocText(text: string): string {
  return text
    .replace(/\r\n?|\u000b/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The fingerprint ignores whitespace entirely (spaces, line and paragraph
// breaks), so only a change in the words themselves counts as an edit -
// adding a blank line between paragraphs in Docs isn't rework.
export function hashDocText(text: string): string {
  return createHash("sha256").update(normalizeDocText(text).replace(/\s+/g, " ")).digest("hex");
}

/** The text an export of this note writes into its Doc right now. */
export function draftExportText(note: Note): string {
  return buildDocBody(note).text;
}

/** What the Doc's text should look like if nobody has edited it there: the
 *  fingerprint recorded at the last export, or - for notes exported before
 *  fingerprints existed - the note's current draft text. */
export function exportBaselineHash(note: Note): string {
  return note.google_doc_export_hash ?? hashDocText(draftExportText(note));
}

export async function fetchDoc(docId: string, accessToken: string): Promise<DocsGetResponse> {
  return docsFetch<DocsGetResponse>(`/${docId}`, accessToken);
}

// Style/bullet requests never shift any index (only insertText/
// deleteContentRange do), so these can all be listed after one insertText
// in any relative order and still land on the ranges computed above.
function stylesToRequests(styles: StyleRange[], baseIndex: number): Record<string, unknown>[] {
  return styles.map((s) => {
    const range = { startIndex: baseIndex + s.startIndex, endIndex: baseIndex + s.endIndex };
    switch (s.kind) {
      case "heading":
        return { updateParagraphStyle: { range, paragraphStyle: { namedStyleType: "HEADING_2" }, fields: "namedStyleType" } };
      case "bold":
        return { updateTextStyle: { range, textStyle: { bold: true }, fields: "bold" } };
      case "underline":
        return { updateTextStyle: { range, textStyle: { underline: true }, fields: "underline" } };
    }
  });
}

export class NothingToExportError extends Error {
  constructor() {
    super("This note has no reviewed content yet - wait for at least one page to finish transcribing.");
    this.name = "NothingToExportError";
  }
}

// Thrown instead of re-exporting over a Doc that was edited in Google Docs
// since Inkwell last wrote it - that Doc now holds the writer's rework, and
// overwriting it with the draft would silently throw that work away.
export class GoogleDocChangedError extends Error {
  constructor(public readonly url: string | null) {
    super(
      "This note's Google Doc has been edited since you exported it. Exporting again would " +
        "replace your edits with the draft, so Inkwell didn't. Open the Doc, or export a " +
        "separate copy instead."
    );
    this.name = "GoogleDocChangedError";
  }
}

export interface ExportOptions {
  /** Write the draft into a brand-new Doc without relinking the note, so
   *  the note stays connected to the Doc being reworked. */
  asCopy?: boolean;
}

export async function exportNoteToGoogleDoc(
  note: Note,
  options: ExportOptions = {}
): Promise<{ docId: string; url: string; linked: boolean }> {
  const { text, styles } = buildDocBody(note);
  if (!text) throw new NothingToExportError();

  const accessToken = await getValidAccessToken();
  let docId = options.asCopy ? null : note.google_doc_id;
  const requests: Record<string, unknown>[] = [];

  if (docId) {
    // Re-export: update the same Doc in place (clear then rewrite) rather
    // than creating a new one on every click, so repeated exports stay one
    // stable link - but only while the Doc is still Inkwell's own copy of
    // the draft (see GoogleDocChangedError).
    let existing: DocsGetResponse | null = null;
    try {
      existing = await fetchDoc(docId, accessToken);
    } catch (err) {
      // Only a Doc that no longer exists falls back to creating a fresh
      // one. Anything else (expired access, no permission, offline) must
      // fail: relinking the note to a new Doc here would quietly orphan the
      // Doc the writer is reworking.
      if (!(err instanceof DocsApiError && err.status === 404)) throw err;
      docId = null;
    }

    if (existing) {
      const docText = extractDocText(existing);
      if (docText && hashDocText(docText) !== exportBaselineHash(note)) {
        throw new GoogleDocChangedError(note.google_doc_url);
      }
      const content = existing.body?.content ?? [];
      const endIndex = content.length > 0 ? content[content.length - 1].endIndex : 1;
      // An empty doc's body already ends at index 2 with nothing in between
      // (Docs always keeps one trailing implicit newline) - only delete when
      // there's real content to clear first.
      if (endIndex > 2) {
        requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
      }
    }
  }

  if (!docId) {
    const baseTitle = note.title ?? "Untitled note";
    const created = await docsFetch<DocsCreateResponse>("", accessToken, {
      method: "POST",
      body: JSON.stringify({ title: options.asCopy ? `${baseTitle} (draft copy)` : baseTitle }),
    });
    docId = created.documentId;
  }

  requests.push({ insertText: { location: { index: 1 }, text } });
  requests.push(...stylesToRequests(styles, 1));

  await docsFetch(`/${docId}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });

  const url = `https://docs.google.com/document/d/${docId}/edit`;
  if (options.asCopy) return { docId, url, linked: false };
  notesRepo.setGoogleDocExport(note.id, docId, url, hashDocText(text), new Date().toISOString());
  return { docId, url, linked: true };
}
