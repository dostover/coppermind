"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardArt } from "./CardArt";

// The face-down card and the flip: the moment a fan gets a card, whichever
// way it arrived (a token at the gate, a live stream, a player's social
// drop). Getting a card is the core experience (see "Restated priority" in
// claude/prioritization.md), so every path ends here, the same way.
//
// The card stays hidden until the tap - the surprise is the point - and the
// tap is what actually claims it (`claim`). After the flip: where the card
// came from (for stream and social cards), set progress, the first-card
// Pass It On bonus, and whatever next steps the caller passes in.
export type RevealResult = {
  card: {
    instanceId: string;
    title: string;
    description: string;
    type: string | null;
    imagePath: string | null;
    perk: string | null;
    stats: Record<string, string | number> | null;
  };
  setProgress: {
    title: string;
    owned: number;
    total: number;
    complete: boolean;
    newlyCompleted: boolean;
    perkTitle: string;
  }[];
  gotPassOn: boolean;
  sourceLabel?: string | null;
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

export function CardReveal({
  claim,
  onError,
  backLine = "You had to be there.",
  afterActions,
  refreshAfterReveal = true,
}: {
  claim: () => Promise<RevealResult>;
  // When set, a failed claim is handed back to the caller (the token flow
  // returns to its code box). Otherwise the message shows under the card.
  onError?: (message: string) => void;
  backLine?: string;
  afterActions: React.ReactNode;
  // Refresh the page's server data after the reveal (so counts elsewhere on
  // the page catch up). Off for pages that would replace the reveal itself
  // once the card is claimed, like a drop page's "you already have this one".
  refreshAfterReveal?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevealResult | null>(null);

  async function handleReveal() {
    setBusy(true);
    setError(null);
    try {
      const r = await claim();
      setResult(r);
      if (refreshAfterReveal) router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't get that card.";
      if (onError) onError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  const revealed = result !== null;
  const card = result?.card;

  return (
    <div className="reveal">
      <div className={"reveal-card" + (revealed ? " reveal-card-flipped" : "")}>
        <div className="reveal-face reveal-back" aria-hidden={revealed}>
          <p className="reveal-back-title">Banana Cards</p>
          <p className="reveal-back-line">{backLine}</p>
          {!revealed && !error && (
            <button type="button" className="reveal-button" onClick={handleReveal} disabled={busy}>
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
              {result?.sourceLabel && <p className="card-tile-source">{result.sourceLabel}</p>}
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

      {error && (
        <p role="alert" className="sign-in-error reveal-error">
          {error}
        </p>
      )}

      {result && (
        <div className="reveal-after" role="status">
          <p className="redeemed-card-title">It&apos;s yours: {result.card.title}</p>
          {result.setProgress.length > 0 && (
            <ul className="redeem-set-progress">
              {result.setProgress.map((set) => (
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
          {result.gotPassOn && (
            <p className="pass-it-on-callout">
              <strong>Bonus for your first card:</strong> a Pass It On card to give to someone new to Banana
              Ball. <Link href="/trade#pass-it-on">Pass it on</Link>
            </p>
          )}
          <div className="redeem-actions">{afterActions}</div>
        </div>
      )}
    </div>
  );
}
