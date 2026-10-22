"use client";

import { useRouter } from "next/navigation";
import { QuickJoin } from "./QuickJoin";

// The not-signed-in half of /redeem?code=...: join with a name, then reload
// the same page, which now shows the face-down card ready to reveal.
export function JoinToRedeem() {
  const router = useRouter();
  return <QuickJoin buttonLabel="Claim my card" onJoined={() => router.refresh()} />;
}
