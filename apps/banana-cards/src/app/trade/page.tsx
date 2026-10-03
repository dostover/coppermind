import Link from "next/link";
import QRCode from "qrcode";
import { getFanFromCookies } from "@/lib/authSession";
import { cardInstancesRepo, fansRepo, tradesRepo } from "@/lib/db";
import { TradeBoard } from "@/components/TradeBoard";
import { CopyableCode } from "@/components/CopyableCode";
import { DEMO_PERSONAS } from "@/lib/demoPersonas";

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

  // Dev-only: lets one person demo a trade solo (a second browser
  // window/incognito profile signed in as another persona) without needing
  // to physically hand a phone back and forth to read a QR code. Looks up
  // each other seeded persona's fan id - their real trade code, the exact
  // same value their own /trade page shows - so it's copy-pasteable
  // straight into "Their trade code" below. Silently produces nothing if a
  // persona hasn't been seeded yet (npm run seed not run), rather than
  // erroring the page.
  const otherDemoTradeCodes =
    process.env.NODE_ENV !== "production"
      ? DEMO_PERSONAS.map((p) => ({ ...p, fanRow: fansRepo.getByEmail(p.email) }))
          .filter((p) => p.fanRow && p.fanRow.id !== fan.id)
          .map((p) => ({ displayName: p.displayName, fanId: p.fanRow!.id }))
      : [];

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

      {otherDemoTradeCodes.length > 0 && (
        <section className="demo-switcher">
          <h2>Demo: other trade codes</h2>
          <p>
            Copy a code and paste it into &quot;Their trade code&quot; above to demo a trade solo,
            from a second browser window/incognito profile signed in as that persona.
          </p>
          <div className="demo-trade-code-list">
            {otherDemoTradeCodes.map((p) => (
              <div key={p.fanId} className="demo-trade-code-row">
                <span className="demo-trade-code-name">{p.displayName}</span>
                <CopyableCode value={p.fanId} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
