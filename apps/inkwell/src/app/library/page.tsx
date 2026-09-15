import Link from "next/link";
import { notesRepo, foldersRepo } from "@/lib/db";
import { NewFolderForm } from "@/components/NewFolderForm";
import { GoogleConnectionControl } from "@/components/GoogleConnectionControl";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { isGoogleConnected } from "@/lib/google/oauth";

function snippet(text: string, max = 140): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string; googleConnected?: string; googleError?: string }>;
}) {
  const { q, folder, googleError } = await searchParams;
  // folder: absent = All notes, "none" = unfiled only, else a folder id -
  // mirrors GET /api/notes' folder param.
  const folderId = folder === undefined ? undefined : folder === "none" ? null : folder;
  const notes = notesRepo.listAll(q, folderId);
  const folders = foldersRepo.listAll();
  const activeFolderName =
    folderId === undefined ? "All notes" : folderId === null ? "Unfiled" : folders.find((f) => f.id === folderId)?.name ?? "Folder";

  return (
    <div>
      <h1>Library</h1>
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
        <Link href="/library" className={`folder-pill${folderId === undefined ? " active" : ""}`}>
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
      </div>

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


      {notes.length === 0 && (
        <div className="empty-state">
          <p className="muted" style={{ margin: 0 }}>
            {q
              ? "No notes match that search."
              : folderId !== undefined
                ? `No notes in ${activeFolderName}.`
                : "No notes yet - capture your first page."}
          </p>
        </div>
      )}

      {notes.map((note) => {
        const bodyText = note.segmentsCurrent.map((s) => s.text).join(" ");
        const flaggedCount = note.segmentsCurrent.filter((s) => s.reviewRequired).length;
        const noteFolder = note.folder_id ? folders.find((f) => f.id === note.folder_id) : null;
        return (
          <Link key={note.id} href={`/notes/${note.id}`} className="note-card card">
            <strong>{note.title ?? "Untitled note"}</strong>
            <p className="muted">{snippet(bodyText) || "No transcription yet."}</p>
            <p className="muted">
              {note.status}
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
