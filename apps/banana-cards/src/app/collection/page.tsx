import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { cardInstancesRepo, setsRepo } from "@/lib/db";
import { CollectionBoard } from "@/components/CollectionBoard";
import { SetsBoard } from "@/components/SetsBoard";
import { KeepsakesShelf } from "@/components/KeepsakesShelf";

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

  // Pass-it-on cards aren't really part of the collection - they're waiting
  // to be given away - so they sit in their own callout instead of the grid.
  // Keepsakes (moment cards) get their own shelf too: they can't be traded
  // and aren't part of any set, so they'd only muddy the tradeable grid.
  const allCards = cardInstancesRepo.listByOwnerWithTemplate(fan.id);
  const passOnCount = allCards.filter((c) => c.pass_on).length;
  const keepsakes = allCards.filter((c) => !c.pass_on && c.keepsake);
  const cards = allCards.filter((c) => !c.pass_on && !c.keepsake);
  const sets = setsRepo.listProgressForFan(fan.id);

  return (
    <main className="page page-wide">
      <h1>My collection</h1>
      <p>
        Signed in as <strong>{fan.display_name}</strong>.
      </p>

      {passOnCount > 0 && (
        <p className="pass-it-on-callout">
          You have {passOnCount === 1 ? "a Pass It On card" : `${passOnCount} Pass It On cards`} to give to
          someone new. <Link href="/trade#pass-it-on">Pass it on</Link>
        </p>
      )}

      {keepsakes.length > 0 && <KeepsakesShelf cards={keepsakes} />}

      {cards.length === 0 ? (
        keepsakes.length === 0 && (
          <p>
            No cards yet. <Link href="/redeem">Redeem a code</Link> to get your first one.
          </p>
        )
      ) : (
        <>
          {/* Sets lead: they're what gives the collection a next step. */}
          {sets.length > 0 && <SetsBoard sets={sets} />}
          <h2 className="collection-cards-heading">Cards to trade</h2>
          <CollectionBoard cards={cards} />
        </>
      )}

      <p>
        <Link href="/redeem">Redeem another code</Link> · <Link href="/trade">Trade with a fan</Link> ·{" "}
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
