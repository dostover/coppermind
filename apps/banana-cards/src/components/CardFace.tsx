import type { OwnedCardView } from "@/lib/db";
import { TYPE_ICONS } from "./icons";
import { CardArt } from "./cardArt";

// The one shared visual for "what a card looks like," used by the
// collection grid, the redeem reveal, and both sides of the trade picker.
// Two layouts share this component:
//  - full (default): a real trading-card shape - an illustrated art panel
//    on top (see cardArt.tsx for what's actually drawn per type), a dark
//    text plate below with the title/bio/stats. This is the "complete
//    card" treatment used anywhere a fan is meant to sit with one card.
//  - compact (collection grid, trade pick tiles): the same illustration as
//    a low-opacity watermark behind a denser text block, so a grid of
//    these still reads at a glance without losing the art entirely.
// No per-card photography exists (and per the standing "no real player
// names or likeness" content rule, never will be real photos) - the
// artwork is original flat-vector illustration, not a gradient standing
// in for art. image_path stays reserved on card_templates for a future
// real-photo pipeline; nothing here reads it yet.
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

export function CardFace({
  type,
  title,
  playerName,
  stats,
  description,
  compact,
}: {
  type: OwnedCardView["type"];
  title: string;
  playerName?: string | null;
  stats?: Record<string, string | number> | null;
  description?: string | null;
  compact?: boolean;
}) {
  const Icon = TYPE_ICONS[type];

  if (compact) {
    return (
      <div className={`card-face card-face-compact card-face-${type}`}>
        <div className="card-face-art-watermark">
          <CardArt type={type} title={title} />
        </div>
        <div className="card-face-top">
          <Icon className="card-face-icon" strokeWidth={2.25} aria-hidden />
          <span className="card-face-type">{TYPE_LABELS[type]}</span>
        </div>
        <div className="card-face-body">
          <h3 className="card-face-title">{title}</h3>
          {playerName && playerName !== title && <p className="card-face-player">{playerName}</p>}
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
        <CardArt type={type} title={title} />
        <span className="card-face-type card-face-type-onart">{TYPE_LABELS[type]}</span>
      </div>
      <div className="card-face-plate">
        <div className="card-face-body">
          <h3 className="card-face-title">{title}</h3>
          {playerName && playerName !== title && <p className="card-face-player">{playerName}</p>}
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
