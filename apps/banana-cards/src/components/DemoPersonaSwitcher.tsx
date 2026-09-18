"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";

// Dev-only convenience for live demos: one click signs in as one of
// scripts/seed.ts's four demo personas, reusing the exact same devCode
// mechanism the regular /sign-in flow already relies on (see
// src/app/api/auth/request-code/route.ts) - this isn't a new auth path, it
// just automates typing the email and copying the code back by hand. Kept
// in sync with scripts/seed.ts by convention, not by import (the seed
// script runs standalone via tsx, outside the Next.js app).
const PERSONAS = [
  { email: "peelmaster@example.com", displayName: "Peel Master Flex", blurb: "Broad collector, 9 cards" },
  { email: "rookienanas@example.com", displayName: "Rookie Nanas", blurb: "Brand-new fan, 2 cards" },
  { email: "sluggo@example.com", displayName: "Sluggo", blurb: "1 confirmed trade, 1 to confirm" },
  { email: "zesty@example.com", displayName: "Zesty", blurb: "Pending trade awaiting Sluggo" },
] as const;

export function DemoPersonaSwitcher() {
  const router = useRouter();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(email: string) {
    setBusyEmail(email);
    setError(null);
    try {
      const codeRes = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!codeRes.ok) throw new Error(await extractErrorMessage(codeRes, "Could not get a code."));
      const { devCode } = (await codeRes.json()) as { devCode?: string };
      if (!devCode) {
        throw new Error(
          "No dev code came back, so quick switch can't sign in on its own - use the regular " +
            "sign-in flow instead."
        );
      }

      const signInRes = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: devCode }),
      });
      if (!signInRes.ok) {
        throw new Error(await extractErrorMessage(signInRes, "Could not sign in as that persona."));
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch personas.");
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="demo-switcher">
      <h2>Demo: quick switch</h2>
      <p>
        One-click sign-in as a seeded persona (run <code>npm run seed</code> first if none of
        this works). Dev only.
      </p>
      <div className="demo-switcher-list">
        {PERSONAS.map((p) => (
          <button
            key={p.email}
            type="button"
            className="demo-switcher-pill"
            onClick={() => switchTo(p.email)}
            disabled={busyEmail !== null}
          >
            <span>{busyEmail === p.email ? "Switching..." : p.displayName}</span>
            <span className="demo-switcher-blurb">{p.blurb}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </div>
  );
}
