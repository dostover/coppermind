"use client";

import Link from "next/link";
import { extractErrorMessage } from "@/lib/fetchError";
import { CardReveal, type RevealResult } from "./CardReveal";

// Claiming a stream or social drop: the same face-down card and reveal as a
// token at the gate, with the card's source ("Watched live on the Banana Ball stream", "From
// Static's drop") shown on its face.
export function DropClaim({ token, backLine }: { token: string; backLine: string }) {
  async function claim(): Promise<RevealResult> {
    const res = await fetch(`/api/drops/${encodeURIComponent(token)}/claim`, { method: "POST" });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Couldn't get that card."));
    const data = (await res.json()) as {
      card: RevealResult["card"];
      sourceLabel: string;
      setProgress: RevealResult["setProgress"];
    };
    return { card: data.card, setProgress: data.setProgress ?? [], gotPassOn: false, sourceLabel: data.sourceLabel };
  }

  return (
    <CardReveal
      claim={claim}
      backLine={backLine}
      refreshAfterReveal={false}
      afterActions={
        <Link href="/collection" className="button-link">
          See my collection
        </Link>
      }
    />
  );
}
