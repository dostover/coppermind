"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Same small-client-component-for-one-action pattern as apps/inkwell's
// GoogleConnectionControl disconnect button.
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={busy} className="link-button">
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
