"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranscriptSegment } from "@/lib/ai/types";
import type { FolderRow, NoteTagView } from "@/lib/db";

interface Props {
  noteId: string;
  imagePath: string;
  initialTitle: string | null;
  initialSegments: TranscriptSegment[];
  status: string;
  initialFolderId: string | null;
  initialTags: NoteTagView[];
  allFolders: FolderRow[];
  allTagNames: string[];
}

export function ReviewEditor({
  noteId,
  imagePath,
  initialTitle,
  initialSegments,
  status,
  initialFolderId,
  initialTags,
  allFolders,
  allTagNames,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [segments, setSegments] = useState(initialSegments);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const flaggedCount = segments.filter((s) => s.reviewRequired).length;
  const crossedOutCount = segments.filter((s) => s.crossedOut).length;

  function updateSegment(id: string, text: string) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
    setSavedMessage(null);
  }

  // Local-only until Save - the tags/folder edits ride along with the same
  // PATCH as segments/title, so nothing is written to the server until the
  // user hits Save (matches how segment/title edits already behave).
  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput("");
      return;
    }
    setTags((prev) => [
      ...prev,
      { id: `local-${trimmed}`, name: trimmed, source: "user", confidence: null },
    ]);
    setTagInput("");
    setSavedMessage(null);
  }

  function removeTag(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setSavedMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setErrorMessage(null);
    const changedCount = segments.filter(
      (s, i) => s.text !== initialSegments[i]?.text
    ).length;

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          segments: segments.map((s) => ({ id: s.id, text: s.text })),
          folderId,
          tags: tags.map((t) => t.name),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setSavedMessage(
        changedCount > 0
          ? `Saved - ${changedCount} correction${changedCount === 1 ? "" : "s"} recorded.`
          : "Saved."
      );
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/retry`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Retry failed.");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      "Delete this note? This permanently removes the transcription and the original photo. This can't be undone."
    );
    if (!ok) return;

    setDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed.");
      router.push("/library");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  // Render consecutive non-heading segments as one flowing "line" (a natural
  // reading paragraph made of individually-editable words/phrases), and
  // headings on their own line - rather than one full-width box per
  // segment, which reads badly once segments are word-granular (see
  // src/lib/ai/mockProvider.ts for why they're granular in the first place).
  const lines: { type: "heading" | "flow"; segments: TranscriptSegment[] }[] = [];
  for (const segment of segments) {
    const isHeading = segment.structureType === "heading";
    const last = lines[lines.length - 1];
    if (isHeading) {
      lines.push({ type: "heading", segments: [segment] });
    } else if (last && last.type === "flow") {
      last.segments.push(segment);
    } else {
      lines.push({ type: "flow", segments: [segment] });
    }
  }

  if (status === "error") {
    return (
      <div className="card">
        <p style={{ color: "#a33" }}>
          Transcription failed. The original image is intact - you can retry.
        </p>
        <button className="button" onClick={handleRetry} disabled={retrying}>
          {retrying ? "Retrying..." : "Retry transcription"}
        </button>{" "}
        <button className="button danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting..." : "Delete note"}
        </button>
        {errorMessage && <p style={{ color: "#a33" }}>{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div>
      <img src={`/${imagePath}`} alt="Uploaded handwritten page" className="note-image" />

      <input
        className="field"
        placeholder="Untitled note"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ marginBottom: "1rem", fontSize: "1.1rem" }}
      />

      <div className="organize-row">
        <label className="muted" htmlFor="folder-select">
          Folder:
        </label>
        <select
          id="folder-select"
          className="field folder-select"
          value={folderId ?? ""}
          onChange={(e) => {
            setFolderId(e.target.value || null);
            setSavedMessage(null);
          }}
        >
          <option value="">No folder</option>
          {allFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tags-editor">
        {tags.map((t) => (
          <span key={t.id} className={`tag-chip${t.source === "ai" ? " ai-suggested" : ""}`}>
            {t.name}
            {t.source === "ai" && <span className="tag-ai-label">AI</span>}
            <button
              type="button"
              className="tag-remove"
              aria-label={`Remove tag ${t.name}`}
              onClick={() => removeTag(t.id)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          list="tag-suggestions"
          placeholder="Add a tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
        />
        <datalist id="tag-suggestions">
          {allTagNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      {tags.some((t) => t.source === "ai") && (
        <p className="muted">
          Tags marked <span className="tag-ai-label">AI</span> were suggested automatically -
          remove any that don&apos;t fit, or just save to keep them.
        </p>
      )}

      {flaggedCount > 0 && (
        <p className="muted">
          {flaggedCount} item{flaggedCount === 1 ? "" : "s"} still flagged for review - you
          can save without resolving them.
        </p>
      )}
      {crossedOutCount > 0 && (
        <p className="muted">
          <span className="crossed-out-sample">abc</span> {crossedOutCount} word
          {crossedOutCount === 1 ? "" : "s"} shown with a strikethrough were crossed out in the
          original - kept for reference, but feel free to delete them if you don&apos;t want them
          in the note.
        </p>
      )}

      <div className="transcription">
        {lines.map((line, i) =>
          line.type === "heading" ? (
            <h2 key={line.segments[0].id} className="segment-heading">
              <input
                className="segment-input"
                value={line.segments[0].text}
                onChange={(e) => updateSegment(line.segments[0].id, e.target.value)}
              />
            </h2>
          ) : (
            <p key={i} className="flow">
              {line.segments.map((segment) => {
                const titleParts = [
                  segment.crossedOut ? "Crossed out in the original - kept here, delete if you don't want it" : null,
                  segment.reviewRequired ? "Needs review - AI wasn't confident here" : null,
                ].filter(Boolean);
                return (
                  <input
                    key={segment.id}
                    className={[
                      "segment-input",
                      segment.reviewRequired ? "flagged" : "",
                      segment.crossedOut ? "crossed-out" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={titleParts.length ? titleParts.join(" — ") : undefined}
                    value={segment.text}
                    onChange={(e) => updateSegment(segment.id, e.target.value)}
                  />
                );
              })}
            </p>
          )
        )}
      </div>

      <button className="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>{" "}
      <button className="button danger" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete note"}
      </button>
      {savedMessage && <p className="muted">{savedMessage}</p>}
      {errorMessage && <p style={{ color: "#a33" }}>{errorMessage}</p>}
    </div>
  );
}
