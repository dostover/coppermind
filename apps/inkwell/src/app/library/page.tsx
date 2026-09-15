import Link from "next/link";
import type { ReactNode } from "react";
import { notesRepo, foldersRepo } from "@/lib/db";
import { NewFolderForm } from "@/components/NewFolderForm";
import { GoogleConnectionControl } from "@/components/GoogleConnectionControl";
import { StatusBadge } from "@/components/StatusBadge";
import { TrashNoteActions } from "@/components/TrashNoteActions";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { isGoogleConnected } from "@/lib/google/oauth";

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
  const idx = fullText.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (idx === -1) {
    return fullText.length > max ? fullText.slice(0, max).trimEnd() + "…" : fullText;
  }
  const half = Math.floor(max / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(fullText.length, start + max);
  return (start > 0 ? "…" : "") + fullText.slice(start, end).trim() + (end < fullText.length ? "…" : "");
}

function highlightMatches(text: string, query: string | undefined): ReactNode {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) return text;
  const idx = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-hit">{text.slice(idx, idx + trimmedQuery.length)}</mark>
      {text.slice(idx + trimmedQuery.length)}
    </>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string; googleConnected?: string; googleError?: string }>;
}) {
  const { q, folder, googleError } = await searchParams;
  const isTrash = folder === "trash";
  // folder: absent = All notes, "none" = unfiled only, "trash" = Trash view,
  // else a folder id - mirrors GET /api/notes' folder param.
  const folderId = folder === undefined || isTrash ? undefined : folder === "none" ? null : folder;
  const notes = isTrash ? notesRepo.listAll(q, undefined, "trash") : notesRepo.listAll(q, folderId);
  const folders = foldersRepo.listAll();
  const activeFolderName =
    folderId === undefined ? "All notes" : folderId === null ? "Unfiled" : folders.find((f) => f.id === folderId)?.name ?? "Folder";

  return (
    <div>
      <h1>{isTrash ? "Trash" : "Library"}</h1>
      <form className="card" style={{ marginBottom: "1.5rem" }}>
        {folder && <input type="hidden" name="folder" value={folder} />}
        <input
          className="field"
          type="search"
          name="q"
          placeholder="Search your notes…"
          defaultValue={q ?? ""}
        />
      </form>

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
                  {highlightMatches(snippetWindow(bodyText, q) || "No transcription yet.", q)}
                </p>
                <p className="muted note-card-meta">
                  <StatusBadge status={note.status} />
                  {note.pages.length > 1 ? ` · ${note.pages.length} pages` : ""}
                  {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""} ·{" "}
                  {new Date(note.created_at).toLocaleString()}
                  {noteFolder ? ` · ${noteFolder.name}` : ""}
                </p>
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
