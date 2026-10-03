"use client";

import { useState } from "react";

// Small dev-tool building block: a code value that copies itself to the
// clipboard on click. Used by the trade page's demo trade-code list so a
// solo tester can copy another persona's trade code in one window and
// paste it into "Their trade code" in a second window/incognito profile
// signed in as that persona - see trade/page.tsx.
export function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (non-HTTPS context, permissions,
      // older browser) - the value is still visible and selectable by hand
      // either way, so this is a nice-to-have, not a hard dependency.
    }
  }

  return (
    <button type="button" className="copyable-code" onClick={handleClick}>
      <code>{value}</code>
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}
