import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { cardInstancesRepo } from "@/lib/db";
import { CollectionBoard } from "@/components/CollectionBoard";

// Server component reads the collection directly via the repo (no round
// trip through /api/cards/mine - that route exists as the API-first twin
// for a future mobile client, see claude/technical-decisions.md). Filtering
// and sorting happen client-side in CollectionBoard over this same fetched
// list - a fan's collection is small enough that there's no need for the
// server to do it, and it keeps every filter/sort combination instant.
export default async function CollectionPage() {
  const fan = await getFanFromCookies();

  if (!fan) {
    return (
      <main className="page">
        <h1>My collection</h1>
        <p>
          <Link href="/sign-in">Sign in</Link> first to see your collection.
        </p>
      </main>
    );
  }

  const cards = cardInstancesRepo.listByOwnerWithTemplate(fan.id);

  return (
    <main className="page page-wide">
      <h1>My collection</h1>
      <p>
        Signed in as <strong>{fan.display_name}</strong>.
      </p>

      {cards.length === 0 ? (
        <p>
          No cards yet. <Link href="/redeem">Redeem a code</Link> to get your first one.
        </p>
      ) : (
        <CollectionBoard cards={cards} />
      )}

      <p>
        <Link href="/redeem">Redeem another code</Link> · <Link href="/trade">Trade with a fan</Link> ·{" "}
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
