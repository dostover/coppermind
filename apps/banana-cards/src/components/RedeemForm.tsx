"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";

// Same shape as SignInFlow: a "use client" component owning its own state,
// POSTing to the API route, rendered from a plain server page. Success
// stays on this page (rather than redirecting) so the fan sees exactly
// which card they just got before deciding what to do next.
type RedeemedCard = {
  instanceId: string;
  title: string;
  description: string;
  type: string | null;
  stats: Record<string, string | number> | null;
};

export function RedeemForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<RedeemedCard | null>(null);
  const [gotPassOn, setGotPassOn] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "That code didn't work."));
      }
      const data = (await res.json()) as {
        card: RedeemedCard;
        passOnCard: { instanceId: string } | null;
      };
      setRedeemed(data.card);
      setGotPassOn(data.passOnCard !== null);
      setCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (redeemed) {
    return (
      <div className="redeemed-card">
        <h2>You got a card!</h2>
        <p className="redeemed-card-title">{redeemed.title}</p>
        {redeemed.description && <p>{redeemed.description}</p>}
        {redeemed.stats && (
          <p className="card-tile-stats">
            {Object.entries(redeemed.stats)
              .map(([label, value]) => `${label} ${value}`)
              .join(" · ")}
          </p>
        )}
        {gotPassOn && (
          <p className="pass-it-on-callout">
            <strong>Bonus for your first card:</strong> a Pass It On card to give to someone new to Banana
            Ball. <a href="/trade#pass-it-on">Pass it on</a>
          </p>
        )}
        <div className="redeem-actions">
          <button
            type="button"
            onClick={() => {
              setRedeemed(null);
              setGotPassOn(false);
            }}
          >
            Redeem another code
          </button>
          <a href="/collection" className="link-button">
            View my collection
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="redeem-form">
      <label htmlFor="redeem-code">Redemption code</label>
      <input
        id="redeem-code"
        required
        autoFocus
        autoCapitalize="characters"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="BB-ROSTER-001"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Redeeming..." : "Redeem"}
      </button>
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </form>
  );
}
