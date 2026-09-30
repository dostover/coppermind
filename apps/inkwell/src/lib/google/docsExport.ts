import { notesRepo, type Note } from "@/lib/db";
import type { TranscriptSegment } from "@/lib/ai/types";
import { getValidAccessToken } from "./oauth";

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

interface DocsGetResponse {
  body?: { content?: { endIndex: number }[] };
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
    throw new Error(`Google Docs API request failed (${res.status}): ${detail || res.statusText}`);
  }
  return (await res.json()) as T;
}

type StyleKind = "heading" | "bold" | "underline" | "strikethrough";

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
// What's kept: the text and line breaks exactly as transcribed, crossed-out
// text (strikethrough - matching the review screen's own choice to show
// crossed-out text rather than deleting it), and bold/underline emphasis
// from the handwriting. What's deliberately NOT applied (2026-09-30): the
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

    for (const line of groupIntoLines(page.segmentsCurrent)) {
      line.forEach((segment, i) => {
        if (i > 0) text += " ";
        const segStart = text.length;
        text += segment.text;
        const segEnd = text.length;
        if (segment.crossedOut) styles.push({ startIndex: segStart, endIndex: segEnd, kind: "strikethrough" });
        if (segment.emphasis === "bold_or_heavy") styles.push({ startIndex: segStart, endIndex: segEnd, kind: "bold" });
        if (segment.emphasis === "underline") styles.push({ startIndex: segStart, endIndex: segEnd, kind: "underline" });
      });
      text += "\n";
    }
  }

  return { text, styles };
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
      case "strikethrough":
        return { updateTextStyle: { range, textStyle: { strikethrough: true }, fields: "strikethrough" } };
    }
  });
}

export class NothingToExportError extends Error {
  constructor() {
    super("This note has no reviewed content yet - wait for at least one page to finish transcribing.");
    this.name = "NothingToExportError";
  }
}

export async function exportNoteToGoogleDoc(note: Note): Promise<{ docId: string; url: string }> {
  const { text, styles } = buildDocBody(note);
  if (!text) throw new NothingToExportError();

  const accessToken = await getValidAccessToken();
  let docId = note.google_doc_id;
  const requests: Record<string, unknown>[] = [];

  if (docId) {
    // Re-export: update the same Doc in place (clear then rewrite) rather
    // than creating a new one on every click, so repeated exports stay one
    // stable link the user can bookmark/share once.
    try {
      const existing = await docsFetch<DocsGetResponse>(`/${docId}`, accessToken);
      const content = existing.body?.content ?? [];
      const endIndex = content.length > 0 ? content[content.length - 1].endIndex : 1;
      // An empty doc's body already ends at index 2 with nothing in between
      // (Docs always keeps one trailing implicit newline) - only delete when
      // there's real content to clear first.
      if (endIndex > 2) {
        requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
      }
    } catch {
      // The Doc was likely deleted/trashed on Google's side since the last
      // export - fall back to creating a fresh one instead of failing.
      docId = null;
    }
  }

  if (!docId) {
    const created = await docsFetch<DocsCreateResponse>("", accessToken, {
      method: "POST",
      body: JSON.stringify({ title: note.title ?? "Untitled note" }),
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
  notesRepo.setGoogleDocExport(note.id, docId, url, new Date().toISOString());
  return { docId, url };
}
