import type { OwnedCardView } from "@/lib/db";
import { CardArt } from "./CardArt";

// Keepsakes are moment cards (see the pool/moment decision in
// claude/card-value-model.md): each exists because of something this fan
// did, so it stays with them - never traded, never part of a set. They get
// their own shelf rather than a place in the tradeable grid, with no
// completion counts, so there's no pressure attached to them.
export function KeepsakesShelf({ cards }: { cards: OwnedCardView[] }) {
  return (
    <section className="keepsakes" aria-labelledby="keepsakes-heading">
      <h2 id="keepsakes-heading">Keepsakes</h2>
      <p className="keepsakes-intro">
        Cards you earned by being there. They stay with you, so they can&apos;t be traded.
      </p>
      <div className="card-grid">
        {cards.map((card) => (
          <div key={card.instance_id} className="card-tile card-tile-keepsake-tile">
            <CardArt src={card.image_path} />
            <span className="card-tile-type card-tile-keepsake">Keepsake</span>
            <h3>{card.title}</h3>
            {card.player_name && <p className="card-tile-player">{card.player_name}</p>}
            {card.description && <p>{card.description}</p>}
            {card.perk && (
              <p className="card-tile-perk">
                <strong>Unlocks:</strong> {card.perk}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
