"use client";

import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";

// Name-only join for someone who just scanned another fan's QR code with
// their phone camera (see src/app/api/auth/join/route.ts). One field, one
// tap - the whole point is that a new person is in before the moment passes.
// The caller decides what happens next (claim a gift, open a trade) via
// onJoined, which runs once the session cookie is set.
export function QuickJoin({
  tradeWithFanId,
  buttonLabel,
  onJoined,
}: {
  tradeWithFanId?: string;
  buttonLabel: string;
  onJoined: () => void | Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed, tradeWithFanId }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Couldn't get you in."));
      await onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get you in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="redeem-form quick-join">
      <label htmlFor="quick-join-name">What should other fans call you?</label>
      <input
        id="quick-join-name"
        required
        autoFocus
        maxLength={30}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Banana Fan #1"
        disabled={busy}
      />
      <button type="submit" disabled={busy || !displayName.trim()}>
        {busy ? "One sec..." : buttonLabel}
      </button>
      <p className="quick-join-note">No app to download and no email needed.</p>
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </form>
  );
}
