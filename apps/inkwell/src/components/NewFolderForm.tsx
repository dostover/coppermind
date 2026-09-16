"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";

// Manual-only folder creation (no AI folder suggestion this phase) - a
// small inline form rather than a modal, consistent with this app's plain
// server-rendered pages elsewhere.
export function NewFolderForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Could not create folder."));
      setName("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="folder-pill new-folder" onClick={() => setOpen(true)}>
        + New folder
      </button>
    );
  }

  return (
    <span className="new-folder-form">
      <input
        className="field"
        autoFocus
        placeholder="Folder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button type="button" className="button secondary" onClick={handleCreate} disabled={saving}>
        {saving ? "Adding…" : "Add"}
      </button>
      {error && <span className="muted">{error}</span>}
    </span>
  );
}
