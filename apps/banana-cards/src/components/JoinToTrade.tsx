"use client";

import { useRouter } from "next/navigation";
import { QuickJoin } from "./QuickJoin";

// The not-signed-in half of /trade?with=<fanId>: join with a name, then
// reload the same page, which now renders the trade board with that fan
// already looked up and the new fan's welcome card ready to offer.
export function JoinToTrade({ withFanId }: { withFanId: string }) {
  const router = useRouter();
  return (
    <QuickJoin
      tradeWithFanId={withFanId}
      buttonLabel="Join and trade"
      onJoined={() => router.refresh()}
    />
  );
}
