"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TranscriptSegment } from "@/lib/ai/types";

interface Props {
  noteId: string;
  imagePath: string;
  initialTitle: string | null;
  initialSegments: TranscriptSegment[];
  status: string;
}

export function ReviewEditor({ noteId, imagePath, initialTitle, initialSegments, status }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [segments, setSegments] = useState(initialSegments);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const flaggedCount = segments.filter((s) => s.reviewRequired).length;

  function updateSegment(id: string, text: string) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
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

      {flaggedCount > 0 && (
        <p className="muted">
          {flaggedCount} item{flaggedCount === 1 ? "" : "s"} still flagged for review - you
          can save without resolving them.
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
              {line.segments.map((segment) => (
                <input
                  key={segment.id}
                  className={`segment-input ${segment.reviewRequired ? "flagged" : ""}`}
                  title={segment.reviewRequired ? "Needs review - AI wasn't confident here" : undefined}
                  value={segment.text}
                  onChange={(e) => updateSegment(segment.id, e.target.value)}
                />
              ))}
            </p>
          )
        )}
      </div>

      <button className="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
      {savedMessage && <p className="muted">{savedMessage}</p>}
      {errorMessage && <p style={{ color: "#a33" }}>{errorMessage}</p>}
    </div>
  );
}
