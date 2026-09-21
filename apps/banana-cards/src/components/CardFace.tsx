import type { OwnedCardView } from "@/lib/db";
import { TYPE_ICONS } from "./icons";
import { CardArt } from "./cardArt";

// The one shared visual for "what a card looks like," used by the
// collection grid, the redeem reveal, and both sides of the trade picker.
// Two layouts share this component:
//  - full (default): a real trading-card shape - an illustrated art panel
//    on top, a dark text plate below with the title/bio/stats. This is the
//    "complete card" treatment used anywhere a fan is meant to sit with
//    one card.
//  - compact (collection grid, trade pick tiles): the same art as a
//    low-opacity watermark behind a denser text block, so a grid of these
//    still reads at a glance without losing the art entirely.
//
// The art itself: every card_templates row now carries a real image_path
// (see public/card-art/ and scripts/render-card-art.mjs) - original
// cartoon/stick-figure illustrations rendered once to PNG, not photos and
// not per-card AI generation (no image-generation tool is wired into this
// app), per the standing "no real player names or likeness" content rule.
// <CardArt> (cardArt.tsx) is kept as a live-SVG fallback for the rare case
// a template has no image_path yet, so a card never renders with nothing.
const TYPE_LABELS: Record<OwnedCardView["type"], string> = {
  team: "Team",
  roster: "Roster",
  moment: "Moment",
  character: "Character",
  venue: "Venue",
  special_item: "Special item",
  trade_only: "Trade only",
  milestone: "Milestone",
};

function CardArtwork({
  type,
  title,
  imagePath,
}: {
  type: OwnedCardView["type"];
  title: string;
  imagePath?: string | null;
}) {
  if (imagePath) {
    // Static pre-rendered illustration served straight from /public at a
    // fixed small display size - next/image's optimization pipeline isn't
    // needed here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="card-art-img" src={imagePath} alt="" />;
  }
  return <CardArt type={type} title={title} />;
}

export function CardFace({
  type,
  title,
  playerName,
  position,
  imagePath,
  stats,
  description,
  compact,
}: {
  type: OwnedCardView["type"];
  title: string;
  playerName?: string | null;
  position?: string | null;
  imagePath?: string | null;
  stats?: Record<string, string | number> | null;
  description?: string | null;
  compact?: boolean;
}) {
  const Icon = TYPE_ICONS[type];

  if (compact) {
    return (
      <div className={`card-face card-face-compact card-face-${type}`}>
        <div className="card-face-art-watermark">
          <CardArtwork type={type} title={title} imagePath={imagePath} />
        </div>
        <div className="card-face-top">
          <Icon className="card-face-icon" strokeWidth={2.25} aria-hidden />
          <span className="card-face-type">{TYPE_LABELS[type]}</span>
        </div>
        <div className="card-face-body">
          <h3 className="card-face-title">{title}</h3>
          {playerName && playerName !== title && (
            <p className="card-face-player">
              {playerName}
              {position && <span className="card-face-position">{position}</span>}
            </p>
          )}
        </div>
        {stats && (
          <div className="card-face-stats">
            {Object.entries(stats).map(([label, value]) => (
              <span key={label} className="card-face-stat">
                <strong>{value}</strong>
                <em>{label}</em>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`card-face card-face-full card-face-${type}`}>
      <div className="card-face-art-panel">
        <CardArtwork type={type} title={title} imagePath={imagePath} />
        <span className="card-face-type card-face-type-onart">{TYPE_LABELS[type]}</span>
      </div>
      <div className="card-face-plate">
        <div className="card-face-body">
          <h3 className="card-face-title">{title}</h3>
          {playerName && playerName !== title && (
            <p className="card-face-player">
              {playerName}
              {position && <span className="card-face-position">{position}</span>}
            </p>
          )}
          {description && <p className="card-face-description">{description}</p>}
        </div>
        {stats && (
          <div className="card-face-stats">
            {Object.entries(stats).map(([label, value]) => (
              <span key={label} className="card-face-stat">
                <strong>{value}</strong>
                <em>{label}</em>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
