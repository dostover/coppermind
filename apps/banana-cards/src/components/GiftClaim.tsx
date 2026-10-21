"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";
import { QuickJoin } from "./QuickJoin";

// The receiving side of a pass-it-on handoff. Someone new joins with a name
// and the card is claimed in the same motion; a signed-in fan who's eligible
// just taps Claim. Either way the success state points straight back at the
// giver ("trade with them now"), because they're standing right there.
export function GiftClaim({
  token,
  fromFan,
  signedInAs,
  claimedByMe,
  unavailable,
}: {
  token: string;
  fromFan: { id: string; displayName: string };
  signedInAs: string | null;
  claimedByMe: boolean;
  unavailable: string | null;
}) {
  const router = useRouter();
  const [claimed, setClaimed] = useState(claimedByMe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    const res = await fetch(`/api/gifts/${encodeURIComponent(token)}/claim`, { method: "POST" });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Couldn't claim this card."));
    setClaimed(true);
    router.refresh();
  }

  async function handleClaim() {
    setBusy(true);
    setError(null);
    try {
      await claim();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't claim this card.");
    } finally {
      setBusy(false);
    }
  }

  if (claimed) {
    return (
      <div className="redeemed-card">
        <h2>It&apos;s yours.</h2>
        <p>
          It&apos;s in your collection now, marked as a gift from <strong>{fromFan.displayName}</strong>.
        </p>
        <div className="redeem-actions">
          <Link href={`/trade?with=${encodeURIComponent(fromFan.id)}`} className="button-link">
            Trade with {fromFan.displayName}
          </Link>
          <Link href="/collection" className="link-button">
            See my collection
          </Link>
        </div>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="gift-unavailable">
        <p>{unavailable}</p>
        <p>
          <Link href="/">Banana Cards home</Link>
        </p>
      </div>
    );
  }

  if (!signedInAs) {
    return (
      <>
        <QuickJoin
          buttonLabel="Claim my card"
          onJoined={async () => {
            try {
              await claim();
            } catch (err) {
              // Joined fine but the claim itself failed (say, someone else
              // scanned first) - reload so the page shows why, signed in.
              setError(err instanceof Error ? err.message : "Couldn't claim this card.");
              router.refresh();
            }
          }}
        />
        {error && (
          <p role="alert" className="sign-in-error">
            {error}
          </p>
        )}
        <p className="quick-join-alt">
          Already collecting? <Link href="/sign-in">Sign in</Link> instead.
        </p>
      </>
    );
  }

  return (
    <div className="redeem-actions">
      <button type="button" onClick={handleClaim} disabled={busy}>
        {busy ? "Claiming..." : `Claim it as ${signedInAs}`}
      </button>
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </div>
  );
}
