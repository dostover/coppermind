"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  configured: boolean;
  connected: boolean;
  errorFromCallback: string | null;
}

// Lives on the Library page, alongside the other account-wide action
// ("Export all notes"). Connecting is a plain link (GET, redirects to
// Google) rather than a client action, since there's nothing to POST -
// disconnecting needs a real request, so that part is a small client
// component, same pattern as NewFolderForm.
export function GoogleConnectionControl({ configured, connected, errorFromCallback }: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(errorFromCallback);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not disconnect.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (!configured) {
    return (
      <p className="muted">
        Google Docs export isn&apos;t set up yet - it needs a Google OAuth client configured in
        .env.local (see README).
      </p>
    );
  }

  return (
    <p className="muted">
      {connected ? (
        <>
          Google Docs connected.{" "}
          <button
            type="button"
            className="button secondary"
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{ fontSize: "0.85rem", padding: "0.15rem 0.6rem" }}
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </>
      ) : (
        <a className="button secondary" href="/api/integrations/google/connect">
          Connect Google Docs
        </a>
      )}{" "}
      {error && <span style={{ color: "var(--danger)" }}>{error}</span>}
    </p>
  );
}
