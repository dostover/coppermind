"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OwnedCardView, TradeView } from "@/lib/db";
import { extractErrorMessage } from "@/lib/fetchError";

// The web reference client's take on "mutual QR scan" (see
// card-value-model.md): both fans have to be together for this to work at
// all. Fan B shows their code (as text, or as the QR image below - both
// resolve to the same fan id); Fan A types it in to look Fan B up, picks one
// of their own cards to offer and one of Fan B's to request, and proposes.
// That's the proposer's half of "both confirm" - Fan B's explicit Confirm
// tap below is the other half, and is the only thing that actually moves
// ownership.
type LookupResult = {
  fan: { id: string; displayName: string };
  cards: OwnedCardView[];
};

export function TradeBoard({
  myFanId,
  myQrDataUrl,
  myEligibleCards,
  trades,
}: {
  myFanId: string;
  myQrDataUrl: string;
  myEligibleCards: OwnedCardView[];
  trades: TradeView[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/lookup/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Couldn't find that fan."));
      }
      const data = (await res.json()) as LookupResult;
      setLookup(data);
      setOfferId(null);
      setRequestId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find that fan.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePropose() {
    if (!lookup || !offerId || !requestId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toFanId: lookup.fan.id,
          offerCardInstanceId: offerId,
          requestCardInstanceId: requestId,
        }),
      });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Couldn't propose that trade."));
      }
      setLookup(null);
      setCode("");
      setOfferId(null);
      setRequestId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't propose that trade.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(tradeId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${tradeId}/confirm`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Couldn't confirm that trade."));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't confirm that trade.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(tradeId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${tradeId}/cancel`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Couldn't cancel that trade."));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel that trade.");
    } finally {
      setBusy(false);
    }
  }

  const incoming = trades.filter((t) => t.status === "pending" && t.direction === "incoming");
  const outgoing = trades.filter((t) => t.status === "pending" && t.direction === "outgoing");
  const history = trades.filter((t) => t.status !== "pending");

  return (
    <div className="trade-board">
      <section className="trade-code-box">
        <h2>My trade code</h2>
        <p>Show this to a fan you&apos;re trading with in person.</p>
        <Image src={myQrDataUrl} alt="Your trade QR code" width={160} height={160} unoptimized />
        <code className="trade-code-text">{myFanId}</code>
      </section>

      <section className="trade-start">
        <h2>Start a trade</h2>
        <p>Enter the code the other fan showed you.</p>
        <form onSubmit={handleLookup} className="redeem-form">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Their trade code"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !code.trim()}>
            {busy ? "Looking up..." : "Find fan"}
          </button>
        </form>

        {lookup && (
          <div className="trade-propose">
            <h3>Trading with {lookup.fan.displayName}</h3>

            <p className="trade-pick-label">You offer:</p>
            {myEligibleCards.length === 0 ? (
              <p>You don&apos;t have any cards free to offer right now.</p>
            ) : (
              <div className="card-grid trade-pick-grid">
                {myEligibleCards.map((card) => (
                  <button
                    type="button"
                    key={card.instance_id}
                    className={
                      "card-tile trade-pick-tile" +
                      (offerId === card.instance_id ? " trade-pick-tile-selected" : "")
                    }
                    onClick={() => setOfferId(card.instance_id)}
                  >
                    <span className="card-tile-type">{card.type}</span>
                    <h2>{card.title}</h2>
                    {card.stats && (
                      <p className="card-tile-stats">
                        {Object.entries(card.stats)
                          .map(([label, value]) => `${label} ${value}`)
                          .join(" · ")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <p className="trade-pick-label">You request:</p>
            {lookup.cards.length === 0 ? (
              <p>{lookup.fan.displayName} doesn&apos;t have any cards free to trade right now.</p>
            ) : (
              <div className="card-grid trade-pick-grid">
                {lookup.cards.map((card) => (
                  <button
                    type="button"
                    key={card.instance_id}
                    className={
                      "card-tile trade-pick-tile" +
                      (requestId === card.instance_id ? " trade-pick-tile-selected" : "")
                    }
                    onClick={() => setRequestId(card.instance_id)}
                  >
                    <span className="card-tile-type">{card.type}</span>
                    <h2>{card.title}</h2>
                    {card.stats && (
                      <p className="card-tile-stats">
                        {Object.entries(card.stats)
                          .map(([label, value]) => `${label} ${value}`)
                          .join(" · ")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="redeem-actions">
              <button type="button" onClick={handlePropose} disabled={busy || !offerId || !requestId}>
                {busy ? "Proposing..." : "Propose trade"}
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setLookup(null);
                  setOfferId(null);
                  setRequestId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="sign-in-error">
            {error}
          </p>
        )}
      </section>

      {incoming.length > 0 && (
        <section className="trade-list">
          <h2>Waiting on you</h2>
          {incoming.map((trade) => (
            <TradeRow key={trade.id} trade={trade} busy={busy}>
              <button type="button" onClick={() => handleConfirm(trade.id)} disabled={busy}>
                Confirm
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => handleCancel(trade.id)}
                disabled={busy}
              >
                Decline
              </button>
            </TradeRow>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="trade-list">
          <h2>Waiting on them</h2>
          {outgoing.map((trade) => (
            <TradeRow key={trade.id} trade={trade} busy={busy}>
              <button
                type="button"
                className="link-button"
                onClick={() => handleCancel(trade.id)}
                disabled={busy}
              >
                Cancel
              </button>
            </TradeRow>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="trade-list">
          <h2>Trade history</h2>
          {history.map((trade) => (
            <TradeRow key={trade.id} trade={trade} busy={busy} />
          ))}
        </section>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  busy,
  children,
}: {
  trade: TradeView;
  busy: boolean;
  children?: React.ReactNode;
}) {
  void busy;
  return (
    <div className="trade-row">
      <p className="trade-row-summary">
        {trade.offeredByMe.map((c) => c.title).join(", ") || "(nothing)"}
        {" ↔ "}
        {trade.offeredByThem.map((c) => c.title).join(", ") || "(nothing)"}
      </p>
      <p className="trade-row-meta">
        with <strong>{trade.counterpartName}</strong> &middot; {trade.status}
      </p>
      {children && <div className="trade-row-actions">{children}</div>}
    </div>
  );
}
