"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OwnedCardView, TradeView } from "@/lib/db";
import { extractErrorMessage } from "@/lib/fetchError";
import { CardArt } from "./CardArt";

// The web reference client's take on "mutual QR scan" (see
// card-value-model.md): both fans have to be together for this to work at
// all. Fan B shows their code (as text, or as the QR image below - both
// resolve to the same fan id); Fan A types it in to look Fan B up, picks one
// of their own cards to offer and one of Fan B's to request, and proposes.
// That's the proposer's half of "both confirm" - Fan B's explicit Confirm
// tap below is the other half, and is the only thing that actually moves
// ownership.
//
// The QR encodes a link (/trade?with=<fanId>) rather than the bare id, so a
// phone's camera app opens it directly. Arriving through that link sets
// initialWithFanId, and the lookup runs on its own - the scanning fan goes
// straight to picking cards. Pasting the link into the code box works too.
//
// Pass-it-on cards live here as well, because handing one over is the same
// in-person moment as a trade: the giver shows a one-time QR and someone new
// scans it (see /gift/[token]).
type LookupResult = {
  fan: { id: string; displayName: string };
  cards: OwnedCardView[];
};

// Accepts either a bare fan id or a full trade link someone pasted in.
function fanIdFromInput(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("with") ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function TradeBoard({
  myFanId,
  myTradeLink,
  myQrDataUrl,
  myEligibleCards,
  passOnCards,
  trades,
  setNeeds,
  initialWithFanId,
}: {
  myFanId: string;
  myTradeLink: string;
  myQrDataUrl: string;
  myEligibleCards: OwnedCardView[];
  passOnCards: OwnedCardView[];
  trades: TradeView[];
  setNeeds: Record<string, { setTitle: string; completes: boolean }>;
  initialWithFanId?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookUpFan = useCallback(async (fanId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/lookup/${encodeURIComponent(fanId)}`);
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
  }, []);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const fanId = fanIdFromInput(code);
    if (fanId) void lookUpFan(fanId);
  }

  // Arrived by scanning someone's trade QR: look them up straight away. The
  // ref keeps this to once per page load even though router.refresh() after
  // a proposal re-renders the board.
  const autoLookedUp = useRef(false);
  useEffect(() => {
    if (!initialWithFanId || autoLookedUp.current) return;
    autoLookedUp.current = true;
    void lookUpFan(initialWithFanId);
  }, [initialWithFanId, lookUpFan]);

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
        <p className="trade-code-hint">
          They can scan it with their phone camera, even if they don&apos;t have Banana Cards yet.
        </p>
        <Image src={myQrDataUrl} alt="Your trade QR code" width={160} height={160} unoptimized />
        <code className="trade-code-text">{myFanId}</code>
        <a className="trade-code-link" href={myTradeLink}>
          {myTradeLink}
        </a>
      </section>

      {passOnCards.length > 0 && <PassItOn cards={passOnCards} />}

      <section className="trade-start">
        <h2>Start a trade</h2>
        <p>Enter the code (or paste the link) the other fan showed you.</p>
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
                    <CardArt src={card.image_path} variant="thumb" />
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
                    <CardArt src={card.image_path} variant="thumb" />
                    <span className="card-tile-type">{card.type}</span>
                    <h2>{card.title}</h2>
                    {setNeeds[card.template_id] && (
                      <p className="card-tile-set-need">
                        {setNeeds[card.template_id].completes
                          ? `Finishes your set: ${setNeeds[card.template_id].setTitle}`
                          : `For your set: ${setNeeds[card.template_id].setTitle}`}
                      </p>
                    )}
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

// The giver's half of a pass-it-on handoff. Tapping the button asks the API
// for a fresh one-time link (any earlier one for this card stops working)
// and shows it as a QR for the new fan to scan. There's no "sent" state to
// track here - once it's claimed, the card simply leaves this fan's
// collection on the next refresh.
function PassItOn({ cards }: { cards: OwnedCardView[] }) {
  const router = useRouter();
  const [gift, setGift] = useState<{
    cardInstanceId: string;
    url: string;
    qrDataUrl: string;
    expiresAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShow(cardInstanceId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardInstanceId }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Couldn't make a code."));
      const data = (await res.json()) as {
        gift: { url: string; qrDataUrl: string; expiresAt: string };
      };
      setGift({ cardInstanceId, ...data.gift });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make a code.");
    } finally {
      setBusy(false);
    }
  }

  const card = cards[0];
  const expiresAt = gift
    ? new Date(gift.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="pass-it-on" id="pass-it-on">
      <h2>Pass it on</h2>
      <p>
        You have {cards.length === 1 ? "a card" : `${cards.length} cards`} to give to someone new to Banana
        Ball. It&apos;s not yours to keep or trade &mdash; it&apos;s how you bring a friend in.
      </p>
      <div className="card-tile pass-it-on-card">
        <CardArt src={card.image_path} />
        <span className="card-tile-type">pass it on</span>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </div>

      {gift ? (
        <div className="pass-it-on-code">
          <p>Have them scan this with their phone camera:</p>
          <Image src={gift.qrDataUrl} alt="Pass-it-on QR code" width={180} height={180} unoptimized />
          <a className="trade-code-link" href={gift.url}>
            {gift.url}
          </a>
          <p className="trade-code-hint">Works once, until {expiresAt}.</p>
          <div className="redeem-actions">
            <button type="button" onClick={() => router.refresh()}>
              They got it
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => handleShow(gift.cardInstanceId)}
              disabled={busy}
            >
              New code
            </button>
          </div>
        </div>
      ) : (
        <div className="redeem-actions">
          <button type="button" onClick={() => handleShow(card.instance_id)} disabled={busy}>
            {busy ? "One sec..." : "Show pass-it-on code"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </section>
  );
}
