import { notFound } from "next/navigation";
import { notesRepo, foldersRepo, tagsRepo } from "@/lib/db";
import { ReviewEditor } from "@/components/ReviewEditor";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = notesRepo.getById(id);
  if (!note) notFound();

  return (
    <div>
      <h1>{note.title ?? "Untitled note"}</h1>
      <ReviewEditor
        noteId={note.id}
        pages={note.pages}
        initialTitle={note.title}
        initialFolderId={note.folder_id}
        initialTags={note.tags}
        allFolders={foldersRepo.listAll()}
        allTagNames={tagsRepo.listAll().map((t) => t.name)}
      />
    </div>
  );
}
