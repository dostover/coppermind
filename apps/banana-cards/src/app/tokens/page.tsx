import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { redemptionCodesRepo } from "@/lib/db";
import { getRequestOrigin, redeemLinkFor } from "@/lib/origin";

// Dev-only demo token sheet: every unredeemed code as a small souvenir-style
// token with its QR, the stand-in for the physical tokens staff would hand
// out at the gate (see the single-use redemption token decision in
// claude/card-value-model.md). Scan one with a phone's camera to try the
// real flow: the link opens the face-down card, one tap from the reveal.
//
// Tokens never say which card they hold - finding out is the reveal. Hidden
// in production builds, since it lists every live code.
export default async function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const origin = await getRequestOrigin();
  const tokens = await Promise.all(
    redemptionCodesRepo.listUnredeemed().map(async (row) => ({
      code: row.code,
      link: redeemLinkFor(origin, row.code),
      qr: await QRCode.toDataURL(redeemLinkFor(origin, row.code), { margin: 1, width: 200 }),
    }))
  );

  return (
    <main className="page page-wide">
      <h1>Demo tokens</h1>
      <p>
        Stand-ins for the tokens handed out at the gate. Scan one with your phone&apos;s camera to claim a
        card, or click its link. Each works once; run <code>npm run seed</code> to reset them.
      </p>
      {origin.includes("localhost") && (
        <p className="dev-hint">
          These codes point at localhost, which a phone can&apos;t reach. To scan with a phone, start the app
          with <code>npm run dev -- -H 0.0.0.0</code> and open this page from your computer&apos;s network
          address (see the app README).
        </p>
      )}
      {tokens.length === 0 ? (
        <p>Every token has been claimed. Run <code>npm run seed</code> for a fresh set.</p>
      ) : (
        <ul className="token-grid">
          {tokens.map((t) => (
            <li key={t.code} className="token">
              <p className="token-brand">Banana Cards</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL QR, generated server-side */}
              <img src={t.qr} alt={`QR code for token ${t.code}`} width={140} height={140} />
              <p className="token-line">Scan me. You had to be there.</p>
              <a href={t.link} className="token-code">
                {t.code}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
