"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";
import { CardArt } from "./CardArt";

// Getting a card is the core experience (see "Restated priority" in
// claude/prioritization.md), so it ends in a reveal rather than a form
// confirmation. The flow:
//
//   entry   -> type a code (skipped when the fan scanned a token: the QR is a
//              link to /redeem?code=..., so the code arrives already filled)
//   ready   -> the card's back, face down: "Tap to reveal"
//   reveal  -> the tap claims the code (POST /api/cards/redeem) and flips the
//              card over: art, title, story, stats, what it unlocks
//
// What's on the card stays hidden until the tap - the surprise is the point.
// Then: set progress, the first-card Pass It On bonus, and next steps. The
// whole thing takes seconds, so it fits before first pitch or between
// innings and keeps the phone out of the show itself.
type SetStep = {
  title: string;
  owned: number;
  total: number;
  complete: boolean;
  newlyCompleted: boolean;
  perkTitle: string;
};

type RedeemedCard = {
  instanceId: string;
  title: string;
  description: string;
  type: string | null;
  imagePath: string | null;
  perk: string | null;
  stats: Record<string, string | number> | null;
};

type Stage =
  | { name: "entry" }
  | { name: "ready"; code: string }
  | {
      name: "revealed";
      card: RedeemedCard;
      gotPassOn: boolean;
      setProgress: SetStep[];
    };

const TYPE_LABELS: Record<string, string> = {
  team: "Team",
  roster: "Player",
  moment: "Moment",
  character: "Character",
  venue: "Stadium",
  special_item: "Special item",
  trade_only: "Trade only",
  milestone: "Milestone",
};

export function RedeemForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(
    initialCode ? { name: "ready", code: initialCode } : { name: "entry" }
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setStage({ name: "ready", code: trimmed });
  }

  async function handleReveal(codeToClaim: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToClaim }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "That code didn't work."));
      }
      const data = (await res.json()) as {
        card: RedeemedCard;
        passOnCard: { instanceId: string } | null;
        setProgress: SetStep[];
      };
      setStage({
        name: "revealed",
        card: data.card,
        gotPassOn: data.passOnCard !== null,
        setProgress: data.setProgress ?? [],
      });
      setCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
      setStage({ name: "entry" });
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setStage({ name: "entry" });
    setError(null);
    // Drop ?code= so a refresh doesn't offer the same (now spent) token again.
    router.replace("/redeem");
  }

  if (stage.name === "ready" || stage.name === "revealed") {
    const revealed = stage.name === "revealed";
    const card = revealed ? stage.card : null;
    return (
      <div className="reveal">
        <div className={"reveal-card" + (revealed ? " reveal-card-flipped" : "")}>
          <div className="reveal-face reveal-back" aria-hidden={revealed}>
            <p className="reveal-back-title">Banana Cards</p>
            <p className="reveal-back-line">You had to be there.</p>
            {!revealed && (
              <button
                type="button"
                className="reveal-button"
                onClick={() => handleReveal(stage.code)}
                disabled={busy}
              >
                {busy ? "Revealing..." : "Tap to reveal your card"}
              </button>
            )}
          </div>
          <div className="reveal-face reveal-front" aria-hidden={!revealed}>
            {card && (
              <>
                <CardArt src={card.imagePath} variant="reveal" />
                {card.type && <span className="card-tile-type">{TYPE_LABELS[card.type] ?? card.type}</span>}
                <h2 className="reveal-title">{card.title}</h2>
                {card.description && <p className="reveal-description">{card.description}</p>}
                {card.stats && (
                  <p className="card-tile-stats">
                    {Object.entries(card.stats)
                      .map(([label, value]) => `${label} ${value}`)
                      .join(" · ")}
                  </p>
                )}
                {card.perk && (
                  <p className="card-tile-perk">
                    <strong>Unlocks:</strong> {card.perk}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {stage.name === "revealed" && (
          <div className="reveal-after" role="status">
            <p className="redeemed-card-title">It&apos;s yours: {stage.card.title}</p>
            {stage.setProgress.length > 0 && (
              <ul className="redeem-set-progress">
                {stage.setProgress.map((set) => (
                  <li key={set.title}>
                    {set.newlyCompleted ? (
                      <>
                        <strong>Set complete: {set.title}!</strong> You unlocked {set.perkTitle}.
                      </>
                    ) : (
                      <>
                        <strong>{set.title}:</strong> {set.owned} of {set.total}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {stage.gotPassOn && (
              <p className="pass-it-on-callout">
                <strong>Bonus for your first card:</strong> a Pass It On card to give to someone new to
                Banana Ball. <Link href="/trade#pass-it-on">Pass it on</Link>
              </p>
            )}
            <div className="redeem-actions">
              <Link href="/collection" className="button-link">
                See my collection
              </Link>
              <button type="button" className="link-button" onClick={startOver}>
                Redeem another code
              </button>
            </div>
          </div>
        )}
      </div>
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
      <button type="submit" disabled={busy}>
        Continue
      </button>
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </form>
  );
}
