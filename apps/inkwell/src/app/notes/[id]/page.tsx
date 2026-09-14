import { notFound } from "next/navigation";
import { notesRepo } from "@/lib/db";
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
        imagePath={note.image_path}
        initialTitle={note.title}
        initialSegments={note.segmentsCurrent}
        status={note.status}
      />
    </div>
  );
}
