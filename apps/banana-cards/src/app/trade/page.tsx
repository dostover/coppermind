import Link from "next/link";
import QRCode from "qrcode";
import { getFanFromCookies } from "@/lib/authSession";
import { cardInstancesRepo, tradesRepo } from "@/lib/db";
import { TradeBoard } from "@/components/TradeBoard";

export default async function TradePage() {
  const fan = await getFanFromCookies();

  if (!fan) {
    return (
      <main className="page">
        <h1>Trade</h1>
        <p>
          <Link href="/sign-in">Sign in</Link> first to trade cards with another fan.
        </p>
      </main>
    );
  }

  const pendingIds = tradesRepo.pendingCardInstanceIds(fan.id);
  const myEligibleCards = cardInstancesRepo
    .listByOwnerWithTemplate(fan.id)
    .filter((card) => !pendingIds.has(card.instance_id));
  const trades = tradesRepo.listForFan(fan.id);

  // Generated server-side so the client component just renders an <img> -
  // no QR library needed in the browser bundle. Encodes the same fan id a
  // partner would otherwise type in by hand, so manual entry and a real scan
  // (once a mobile client can do one) resolve to the same thing underneath.
  const myQrDataUrl = await QRCode.toDataURL(fan.id, { margin: 1, width: 220 });

  return (
    <main className="page page-wide">
      <h1>Trade</h1>
      <p>
        Signed in as <strong>{fan.display_name}</strong>.
      </p>
      <TradeBoard
        myFanId={fan.id}
        myQrDataUrl={myQrDataUrl}
        myEligibleCards={myEligibleCards}
        trades={trades}
      />
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
