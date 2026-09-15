import { notFound } from "next/navigation";
import { notesRepo, foldersRepo, tagsRepo } from "@/lib/db";
import { ReviewEditor } from "@/components/ReviewEditor";
import { TrashNoteActions } from "@/components/TrashNoteActions";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { isGoogleConnected } from "@/lib/google/oauth";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) notFound();

  // A trashed note (reached via a stale link, browser back, etc.) isn't
  // meant to be reviewed/edited - show the same restore-or-purge choice
  // Trash itself offers, rather than the full editor, so there's no way to
  // silently "save" a note that's supposed to be on its way out.
  if (note.deleted_at) {
    return (
      <div>
        <h1>{note.title ?? "Untitled note"}</h1>
        <div className="card empty-state">
          <p style={{ marginTop: 0 }}>
            This note is in Trash (deleted {new Date(note.deleted_at).toLocaleString()}). Restore
            it to keep editing, or delete it permanently.
          </p>
          <TrashNoteActions noteId={note.id} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{note.title ?? "Untitled note"}</h1>
      <ReviewEditor
        noteId={note.id}
        pages={note.pages}
        initialTitle={note.title}
        initialTitleSource={note.title_source}
        initialFolderId={note.folder_id}
        initialTags={note.tags}
        allFolders={foldersRepo.listAll()}
        allTagNames={tagsRepo.listAll().map((t) => t.name)}
        googleConfigured={GOOGLE_OAUTH_CONFIGURED}
        googleConnected={isGoogleConnected()}
        initialGoogleDocUrl={note.google_doc_url}
      />
    </div>
  );
}
