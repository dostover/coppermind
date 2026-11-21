"use client";

import { useState } from "react";

// Settings: whether Inkwell also re-reads linked Google Docs every 15
// minutes. Off by default - Docs are read when the note is opened, before a
// question is answered, and from "Check Google Docs now".
export function DocsBackgroundToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setSaving(true);
    setError(null);
    setEnabled(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docsBackgroundCheck: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't save the setting.");
      setEnabled(json.docsBackgroundCheck);
    } catch (err) {
      setEnabled(!next);
      setError(err instanceof Error ? err.message : "Couldn't save the setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-toggle">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          data-testid="docs-background-check"
        />{" "}
        Check Google Docs in the background
      </label>
      <p className="muted">
        Inkwell reads a note&apos;s Google Doc when you open the note, before answering a question, and
        when you press &quot;Check Google Docs now&quot;, plus once when it starts. Turn this on to also
        check every linked Doc every 15 minutes, so search keeps up while you rework drafts without
        opening them here.
      </p>
      {error && (
        <p className="toast error" role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
