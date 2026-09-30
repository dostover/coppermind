import Link from "next/link";
import type { ReactNode } from "react";
import { notesRepo, foldersRepo } from "@/lib/db";
import { NewFolderForm } from "@/components/NewFolderForm";
import { GoogleConnectionControl } from "@/components/GoogleConnectionControl";
import { StatusBadge } from "@/components/StatusBadge";
import { TrashNoteActions } from "@/components/TrashNoteActions";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { isGoogleConnected } from "@/lib/google/oauth";
import { AskAnswer } from "@/components/AskAnswer";
import { looksLikeQuestion, queryTerms, searchNotes, type MatchKind } from "@/lib/search";
import { SEMANTIC_SEARCH_CONFIGURED } from "@/lib/embeddings";

// Search-result highlighting: centers the snippet window on the first match
// (rather than always cutting from character 0) so a hit is actually visible
// within the truncated preview, then wraps that match in <mark> - the review
// spec calls for "snippet with the matching text highlighted" (03-ux-screens.md
// §7); this is that, applied to the Library grid rather than a separate
// search screen (full hybrid search/NL answers are still deferred).
function snippetWindow(fullText: string, query: string | undefined, max = 160): string {
  if (!fullText) return "";
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return fullText.length > max ? fullText.slice(0, max).trimEnd() + "…" : fullText;
  }
  const lower = fullText.toLowerCase();
  let idx = lower.indexOf(trimmedQuery.toLowerCase());
  if (idx === -1) {
    // Fall back to the first query word that appears (hybrid matches are
    // often on one word of the query, not the whole phrase).
    const words = queryTerms(trimmedQuery).filter((w) => w.length >= 3);
    idx = words.map((w) => lower.indexOf(w)).filter((i) => i !== -1).sort((a, b) => a - b)[0] ?? -1;
  }
  if (idx === -1) {
    return fullText.length > max ? fullText.slice(0, max).trimEnd() + "…" : fullText;
  }
  const half = Math.floor(max / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(fullText.length, start + max);
  return (start > 0 ? "…" : "") + fullText.slice(start, end).trim() + (end < fullText.length ? "…" : "");
}

// Highlights every occurrence of each query word (3+ letters), not just the
// whole query string - hybrid search matches on individual words and
// stems, so a result's snippet rarely contains the full query verbatim.
function highlightMatches(text: string, query: string | undefined): ReactNode {
  const words = queryTerms(query ?? "").filter((w) => w.length >= 3);
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="search-hit">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

const MATCH_LABELS: Record<MatchKind, string> = {
  exact: "Exact text",
  keyword: "Keyword",
  meaning: "Related idea",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string; ask?: string; googleConnected?: string; googleError?: string }>;
}) {
  const { q, folder, ask, googleError } = await searchParams;
  const isTrash = folder === "trash";
  // folder: absent = All notes, "none" = unfiled only, "trash" = Trash view,
  // else a folder id - mirrors GET /api/notes' folder param.
  const folderId = folder === undefined || isTrash ? undefined : folder === "none" ? null : folder;
  const query = q?.trim() ?? "";
  // Active-library search is hybrid (words + meaning, ranked - see
  // src/lib/search.ts); Trash keeps the plain substring filter. A question
  // (or the Ask button) additionally shows an answer drawn from the notes.
  const hits = !isTrash && query ? await searchNotes(query, folderId) : null;
  const notes = hits
    ? hits.map((h) => h.note)
    : isTrash
      ? notesRepo.listAll(q, undefined, "trash")
      : notesRepo.listAll(undefined, folderId);
  const hitByNote = new Map((hits ?? []).map((h) => [h.note.id, h]));
  const showAnswer = !isTrash && query !== "" && (ask === "1" || looksLikeQuestion(query));
  const folders = foldersRepo.listAll();
  const activeFolderName =
    folderId === undefined ? "All notes" : folderId === null ? "Unfiled" : folders.find((f) => f.id === folderId)?.name ?? "Folder";

  return (
    <div>
      <h1>{isTrash ? "Trash" : "Library"}</h1>
      <form className="card search-form" style={{ marginBottom: "1.5rem" }}>
        {folder && <input type="hidden" name="folder" value={folder} />}
        <div className="search-row">
          <input
            className="field"
            type="search"
            name="q"
            aria-label={isTrash ? "Search Trash" : "Search or ask a question"}
            placeholder={isTrash ? "Search Trash…" : "Search your notes, or ask a question…"}
            defaultValue={q ?? ""}
          />
          <button type="submit" className="button secondary">
            Search
          </button>
          {!isTrash && (
            <button type="submit" name="ask" value="1" className="button">
              Ask
            </button>
          )}
        </div>
        {!isTrash && (
          <p className="muted search-hint">
            Finds notes by idea as well as exact words. Ask a question (or press Ask) to get an answer
            drawn from your notes, with links to where it came from.
            {!SEMANTIC_SEARCH_CONFIGURED &&
              " Searching by idea needs a VOYAGE_API_KEY in .env.local - until then, results match on words only."}
          </p>
        )}
      </form>

      {showAnswer && <AskAnswer key={query} question={query} />}

      <div className="folder-bar">
        <Link href="/library" className={`folder-pill${folderId === undefined && !isTrash ? " active" : ""}`}>
          All notes
        </Link>
        <Link
          href="/library?folder=none"
          className={`folder-pill${folderId === null ? " active" : ""}`}
        >
          Unfiled
        </Link>
        {folders.map((f) => (
          <Link
            key={f.id}
            href={`/library?folder=${f.id}`}
            className={`folder-pill${folderId === f.id ? " active" : ""}`}
          >
            {f.name}
          </Link>
        ))}
        <NewFolderForm />
        <Link href="/library?folder=trash" className={`folder-pill trash-pill${isTrash ? " active" : ""}`}>
          Trash
        </Link>
      </div>

      {!isTrash && (
        <div className="card" style={{ marginBottom: "1.5rem", padding: "1.1rem 1.25rem" }}>
          {notes.length > 0 && (
            <p style={{ marginBottom: "0.6rem" }}>
              <a className="button secondary" href="/api/export">
                Export all notes
              </a>{" "}
              <span className="muted">
                Downloads a zip with every note&apos;s transcription and original photo - a full
                local backup. To send an individual note somewhere you can read/share it online,
                connect Google Docs below and use the Export button on that note.
              </span>
            </p>
          )}
          <GoogleConnectionControl
            configured={GOOGLE_OAUTH_CONFIGURED}
            connected={isGoogleConnected()}
            errorFromCallback={googleError ?? null}
          />
        </div>
      )}

      {isTrash && notes.length > 0 && (
        <p className="muted" style={{ marginBottom: "1.25rem" }}>
          Deleted notes stay here until you restore or permanently delete them - nothing is lost
          just by clicking Delete.
        </p>
      )}

      {notes.length === 0 && (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            {isTrash
              ? "Trash is empty."
              : q
                ? "No notes match that search."
                : folderId !== undefined
                  ? `No notes in ${activeFolderName}.`
                  : "No notes yet - capture your first page."}
          </p>
        </div>
      )}

      {isTrash
        ? notes.map((note) => {
            const bodyText = note.segmentsCurrent.map((s) => s.text).join(" ");
            return (
              <div key={note.id} className="note-card card trash-card">
                <strong>{note.title ?? "Untitled note"}</strong>
                <p className="muted">{snippetWindow(bodyText, undefined) || "No transcription yet."}</p>
                <p className="muted">
                  Deleted {new Date(note.updated_at).toLocaleString()}
                  {note.pages.length > 1 ? ` · ${note.pages.length} pages` : ""}
                </p>
                <TrashNoteActions noteId={note.id} />
              </div>
            );
          })
        : notes.map((note) => {
            const bodyText = note.segmentsCurrent.map((s) => s.text).join(" ");
            const flaggedCount = note.segmentsCurrent.filter((s) => s.reviewRequired).length;
            const noteFolder = note.folder_id ? folders.find((f) => f.id === note.folder_id) : null;
            return (
              <Link key={note.id} href={`/notes/${note.id}`} className="note-card card">
                <strong>{highlightMatches(note.title ?? "Untitled note", q)}</strong>
                <p className="muted">
                  {highlightMatches(
                    snippetWindow(hitByNote.get(note.id)?.snippet ?? bodyText, q) || "No transcription yet.",
                    q
                  )}
                </p>
                <p className="muted note-card-meta">
                  <StatusBadge status={note.status} />
                  {note.pages.length > 1 ? ` · ${note.pages.length} pages` : ""}
                  {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""} ·{" "}
                  {new Date(note.created_at).toLocaleString()}
                  {noteFolder ? ` · ${noteFolder.name}` : ""}
                </p>
                {hitByNote.get(note.id) && (
                  <p className="match-kinds">
                    {hitByNote
                      .get(note.id)!
                      // Without a Voyage key the "meaning" retriever is a
                      // word-overlap stand-in - don't label it as ideas.
                      .matchedBy.filter((k) => k !== "meaning" || SEMANTIC_SEARCH_CONFIGURED)
                      .map((k) => (
                      <span key={k} className={`match-kind match-${k}`}>
                        {MATCH_LABELS[k]}
                      </span>
                    ))}
                  </p>
                )}
                {note.tags.length > 0 && (
                  <p>
                    {note.tags.map((t) => (
                      <span key={t.id} className="tag-chip">
                        {t.name}
                      </span>
                    ))}
                  </p>
                )}
              </Link>
            );
          })}
    </div>
  );
}
