"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";
import { CardReveal, type RevealResult } from "./CardReveal";

// Getting a card from a token. A scanned token arrives with its code
// already filled in (the QR is a link to /redeem?code=...), so the fan lands
// straight on the face-down card; a typed code goes through the box first.
// Either way it ends in the same reveal as stream and social drops (see
// CardReveal).
export function RedeemForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [readyCode, setReadyCode] = useState<string | null>(initialCode ?? null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Bumped on "Redeem another code" so a fresh reveal mounts each time.
  const [round, setRound] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setReadyCode(trimmed);
  }

  async function claim(codeToClaim: string): Promise<RevealResult> {
    const res = await fetch("/api/cards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeToClaim }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "That code didn't work."));
    const data = (await res.json()) as {
      card: RevealResult["card"];
      passOnCard: { instanceId: string } | null;
      setProgress: RevealResult["setProgress"];
    };
    setCode("");
    return { card: data.card, setProgress: data.setProgress ?? [], gotPassOn: data.passOnCard !== null };
  }

  function startOver() {
    setReadyCode(null);
    setError(null);
    setRound((r) => r + 1);
    // Drop ?code= so a refresh doesn't offer the same (now spent) token again.
    router.replace("/redeem");
  }

  if (readyCode) {
    return (
      <CardReveal
        key={round}
        claim={() => claim(readyCode)}
        onError={(message) => {
          setError(message);
          setReadyCode(null);
        }}
        afterActions={
          <>
            <Link href="/collection" className="button-link">
              See my collection
            </Link>
            <button type="button" className="link-button" onClick={startOver}>
              Redeem another code
            </button>
          </>
        }
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="redeem-form">
      <label htmlFor="redeem-code">Code from your token</label>
      <input
        id="redeem-code"
        required
        autoFocus
        autoCapitalize="characters"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="BB-ROSTER-001"
      />
      <button type="submit">Continue</button>
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </form>
  );
}
