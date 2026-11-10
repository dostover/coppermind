import { notesRepo } from "@/lib/db";
import { getValidAccessToken } from "./oauth";
import { DocsApiError, exportBaselineHash, extractDocText, fetchDoc, hashDocText } from "./docsExport";

// Reads a note's linked Google Doc back into Inkwell. The writer's flow is
// handwritten page -> Inkwell (transcribe, fix misreads) -> export to
// Google Docs -> rework the draft there. Without this, Inkwell's search and
// Ask only ever saw the rough draft. Here, when the Doc's text differs from
// what Inkwell last exported, that text is stored as the note's revised
// version (notes.revised_text); searchIndex.ts indexes it alongside the
// draft, and search.ts answers questions from it instead of the draft.
//
// Read-only on Google's side: this never writes to the Doc.

export type DocSyncResult =
  | "revised" // the Doc holds a reworked version, newly found or changed since the last check
  | "unchanged" // nothing new since the last check
  | "cleared" // the Doc matches the export again, so there's no longer a separate revised version
  | "no_doc" // the note isn't linked to a Doc (or is gone)
  | "doc_missing"; // the linked Doc no longer exists on Google's side

export interface DocSyncOutcome {
  result: DocSyncResult;
  /** True when the note's revised text changed and its search index needs rebuilding. */
  needsReindex: boolean;
}

export async function syncRevisedFromGoogleDoc(noteId: string): Promise<DocSyncOutcome> {
  const note = notesRepo.getById(noteId);
  if (!note || !note.google_doc_id) return { result: "no_doc", needsReindex: false };

  const accessToken = await getValidAccessToken();
  let docText: string;
  try {
    docText = extractDocText(await fetchDoc(note.google_doc_id, accessToken));
  } catch (err) {
    // A deleted Doc keeps whatever revised text was last read: losing the
    // Doc shouldn't also erase the last known version of the rework.
    if (err instanceof DocsApiError && err.status === 404) return { result: "doc_missing", needsReindex: false };
    throw err;
  }

  const reworked = docText !== "" && hashDocText(docText) !== exportBaselineHash(note);
  const revisedText = reworked ? docText : null;
  const previous = note.revised_text;
  notesRepo.setRevisedText(note.id, revisedText, new Date().toISOString());

  const sameWords =
    revisedText === previous || (revisedText !== null && previous !== null && hashDocText(revisedText) === hashDocText(previous));
  if (sameWords) return { result: "unchanged", needsReindex: false };
  return { result: revisedText ? "revised" : "cleared", needsReindex: true };
}
