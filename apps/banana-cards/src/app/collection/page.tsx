import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { cardInstancesRepo } from "@/lib/db";

// Server component reads the collection directly via the repo (no round
// trip through /api/cards/mine - that route exists as the API-first twin
// for a future mobile client, see claude/technical-decisions.md).
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
        <div className="card-grid">
          {cards.map((card) => (
            <div key={card.instance_id} className="card-tile">
              <span className="card-tile-type">{card.type}</span>
              <h2>{card.title}</h2>
              {card.player_name && <p className="card-tile-player">{card.player_name}</p>}
              {card.description && <p>{card.description}</p>}
            </div>
          ))}
        </div>
      )}

      <p>
        <Link href="/redeem">Redeem another code</Link> · <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
