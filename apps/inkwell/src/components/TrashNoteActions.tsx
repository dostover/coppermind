"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";

// Trash's two actions (03-ux-screens.md's soft-delete grace period): put a
// note back, or actually get rid of it for good. Deliberately not wrapped in
// the note's own Link - a trashed note isn't meant to be reopened for
// editing from here, just recovered or purged.
export function TrashNoteActions({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"restore" | "purge" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setBusy("restore");
    setError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Restore failed."));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed.");
      setBusy(null);
    }
  }

  async function handlePurge() {
    const ok = window.confirm(
      "Delete this note permanently? This can't be undone - the transcription and original photos will be gone for good."
    );
    if (!ok) return;

    setBusy("purge");
    setError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/purge`, { method: "DELETE" });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Delete failed."));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setBusy(null);
    }
  }

  return (
    <div className="trash-actions">
      <button type="button" className="button secondary" onClick={handleRestore} disabled={busy !== null}>
        {busy === "restore" ? "Restoring…" : "Restore"}
      </button>
      <button type="button" className="button danger" onClick={handlePurge} disabled={busy !== null}>
        {busy === "purge" ? "Deleting…" : "Delete permanently"}
      </button>
      {error && (
        <p className="toast error" role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
