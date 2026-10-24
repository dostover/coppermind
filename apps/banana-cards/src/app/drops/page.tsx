import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { cardTemplatesRepo, dropsRepo } from "@/lib/db";
import { dropLinkFor, getRequestOrigin } from "@/lib/origin";
import { DropConsole, type ConsoleDrop } from "@/components/DropConsole";

// Dev-only drop console: a stand-in for the tools behind "Beyond the
// ballpark" (claude/card-value-model.md). For a stream, it's the producer's
// control - start and end the live window, and the QR that sits in the
// corner of the broadcast. For a social drop, it's what a player or team
// would post: a link with a short message.
//
// The real version needs team, player and staff accounts, which this demo
// doesn't have yet, so the page (and the go-live API) is switched off in
// production builds.
export default async function DropsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const origin = await getRequestOrigin();
  const now = new Date().toISOString();
  const drops: ConsoleDrop[] = await Promise.all(
    dropsRepo.listAll().map(async (row) => {
      const link = dropLinkFor(origin, row.token);
      return {
        ...dropsRepo.toView(row, now),
        cardTitle: cardTemplatesRepo.getById(row.template_id)?.title ?? "",
        link,
        qr: await QRCode.toDataURL(link, { margin: 1, width: 180 }),
      };
    })
  );

  return (
    <main className="page page-wide">
      <h1>Drop console</h1>
      <p>
        Demo stand-in for the people handing out cards beyond the ballpark: the stream producer (start and end the
        live window; the QR is what viewers scan off the broadcast) and players and teams (the link they post on
        their own channels).
      </p>
      <DropConsole drops={drops} />
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
