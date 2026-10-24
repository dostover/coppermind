"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DropView } from "@/lib/db";
import { extractErrorMessage } from "@/lib/fetchError";

export type ConsoleDrop = DropView & { cardTitle: string; link: string; qr: string };

// The interactive half of /drops. Streams first: they're the higher
// priority of the two (see claude/prioritization.md).
export function DropConsole({ drops }: { drops: ConsoleDrop[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setLive(token: string, live: boolean) {
    setBusy(token);
    setError(null);
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(token)}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Couldn't change the stream."));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the stream.");
    } finally {
      setBusy(null);
    }
  }

  const streams = drops.filter((d) => d.kind === "stream");
  const socials = drops.filter((d) => d.kind === "social");

  return (
    <div className="drop-console">
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}

      <section aria-labelledby="streams-heading">
        <h2 id="streams-heading">Live streams</h2>
        <p className="sets-intro">Stream cards can only be claimed while the game is live.</p>
        <div className="drop-grid">
          {streams.map((d) => (
            <article key={d.token} className="drop-card">
              <header className="drop-card-header">
                <span className={"drop-live-badge" + (d.isLive ? "" : " drop-live-badge-ended")}>
                  {d.isLive ? "Live" : "Off air"}
                </span>
                <h3>{d.title}</h3>
              </header>
              <p className="drop-card-meta">
                Card: {d.cardTitle} · {d.claimCount} claimed
              </p>
              <div className="drop-overlay">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL QR, generated server-side */}
                <img src={d.qr} alt={`QR code viewers scan to claim ${d.cardTitle}`} width={110} height={110} />
                <p>
                  On-screen overlay: <strong>Scan for tonight&apos;s card</strong>
                </p>
              </div>
              <a href={d.link} className="trade-code-link">
                {d.link}
              </a>
              <div className="redeem-actions">
                {d.isLive ? (
                  <button type="button" onClick={() => setLive(d.token, false)} disabled={busy === d.token}>
                    End stream
                  </button>
                ) : (
                  <button type="button" onClick={() => setLive(d.token, true)} disabled={busy === d.token}>
                    Go live
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="social-heading">
        <h2 id="social-heading">Player and team drops</h2>
        <p className="sets-intro">
          What a player or team posts on their own channels. Each stays open until the end date they set: no
          countdowns, no &ldquo;only 100 left.&rdquo;
        </p>
        <div className="drop-grid">
          {socials.map((d) => (
            <article key={d.token} className="drop-card">
              <div className="social-post">
                <p className="social-post-author">{d.sourceName}</p>
                <p>
                  New card drop: <strong>{d.cardTitle}</strong>. One for everyone following along. Tap to claim
                  yours.
                </p>
                <a href={d.link} className="trade-code-link">
                  {d.link}
                </a>
              </div>
              <p className="drop-card-meta">
                {d.open
                  ? `Open${d.closesAt ? ` until ${new Date(d.closesAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : ""}`
                  : "Closed"}{" "}
                · {d.claimCount} claimed
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
