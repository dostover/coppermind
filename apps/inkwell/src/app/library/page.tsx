import Link from "next/link";
import { notesRepo } from "@/lib/db";

function snippet(text: string, max = 140): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const notes = notesRepo.listAll(q);

  return (
    <div>
      <h1>Library</h1>
      <form className="card" style={{ marginBottom: "1.5rem" }}>
        <input
          className="field"
          type="search"
          name="q"
          placeholder="Search your notes…"
          defaultValue={q ?? ""}
        />
      </form>

      {notes.length === 0 && (
        <p className="muted">
          {q ? "No notes match that search." : "No notes yet - capture your first page."}
        </p>
      )}

      {notes.map((note) => {
        const bodyText = note.segmentsCurrent.map((s) => s.text).join(" ");
        const flaggedCount = note.segmentsCurrent.filter((s) => s.reviewRequired).length;
        return (
          <Link key={note.id} href={`/notes/${note.id}`} className="note-card card">
            <strong>{note.title ?? "Untitled note"}</strong>
            <p className="muted">{snippet(bodyText) || "No transcription yet."}</p>
            <p className="muted">
              {note.status}
              {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""} ·{" "}
              {new Date(note.created_at).toLocaleString()}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
