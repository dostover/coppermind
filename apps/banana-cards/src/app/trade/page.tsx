import Link from "next/link";
import QRCode from "qrcode";
import { getFanFromCookies } from "@/lib/authSession";
import { cardInstancesRepo, fansRepo, tradesRepo } from "@/lib/db";
import { getRequestOrigin, tradeLinkFor } from "@/lib/origin";
import { TradeBoard } from "@/components/TradeBoard";
import { JoinToTrade } from "@/components/JoinToTrade";

// ?with=<fanId> is what a fan's trade QR points at (see tradeLinkFor). A
// signed-in fan who scans it lands here with that fan already looked up;
// someone without an account gets the quick-join step first and then the
// same thing - the "no-install first trade" from claude/card-value-model.md.
export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string | string[] }>;
}) {
  const fan = await getFanFromCookies();
  const { with: withParam } = await searchParams;
  const withFanId = typeof withParam === "string" ? withParam : undefined;
  const withFan = withFanId ? fansRepo.getById(withFanId) : undefined;

  if (!fan) {
    if (withFan) {
      return (
        <main className="page">
          <h1>Trade with {withFan.display_name}</h1>
          <p>
            {withFan.display_name} wants to trade Banana Cards with you. Pick a name and you&apos;ll get a{" "}
            <strong>Welcome to Banana Ball</strong> card to trade on the spot.
          </p>
          <JoinToTrade withFanId={withFan.id} />
          <p className="quick-join-alt">
            Already collecting? <Link href="/sign-in">Sign in</Link> instead.
          </p>
        </main>
      );
    }

    return (
      <main className="page">
        <h1>Trade</h1>
        <p>
          <Link href="/sign-in">Sign in</Link> first to trade cards with another fan.
        </p>
      </main>
    );
  }

  const myEligibleCards = cardInstancesRepo.listTradeable(fan.id);
  const passOnCards = cardInstancesRepo.listByOwnerWithTemplate(fan.id).filter((c) => c.pass_on);
  const trades = tradesRepo.listForFan(fan.id);

  // Generated server-side so the client component just renders an <img> -
  // no QR library needed in the browser bundle. It encodes a link rather
  // than the bare fan id, so any phone's camera app can open it directly;
  // the fan id is still shown as text for typing in by hand, and both end up
  // at the same lookup.
  const myTradeLink = tradeLinkFor(await getRequestOrigin(), fan.id);
  const myQrDataUrl = await QRCode.toDataURL(myTradeLink, { margin: 1, width: 220 });

  return (
    <main className="page page-wide">
      <h1>Trade</h1>
      <p>
        Signed in as <strong>{fan.display_name}</strong>.
      </p>
      <TradeBoard
        myFanId={fan.id}
        myTradeLink={myTradeLink}
        myQrDataUrl={myQrDataUrl}
        myEligibleCards={myEligibleCards}
        passOnCards={passOnCards}
        trades={trades}
        initialWithFanId={withFan && withFan.id !== fan.id ? withFan.id : undefined}
      />
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
