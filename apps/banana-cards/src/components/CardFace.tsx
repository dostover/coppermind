import type { OwnedCardView } from "@/lib/db";
import { TYPE_ICONS } from "./icons";

// The one shared visual for "what a card looks like," used by the
// collection grid, the redeem reveal, and both sides of the trade picker -
// previously each of those rendered its own plain text tile. No per-card
// artwork exists (and per the standing "no real player names or likeness"
// content rule, never will be real photos), so the art is generated:
// a type-based gradient + a type-based icon, not per-template images.
// image_path stays reserved on card_templates for real artwork later; this
// is the placeholder that makes every card feel designed in the meantime.
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

  return (
    <div className={`card-face card-face-${type}${compact ? " card-face-compact" : ""}`}>
      <div className="card-face-top">
        <Icon className="card-face-icon" strokeWidth={2.25} aria-hidden />
        <span className="card-face-type">{TYPE_LABELS[type]}</span>
      </div>
      <div className="card-face-body">
        <h3 className="card-face-title">{title}</h3>
        {playerName && playerName !== title && <p className="card-face-player">{playerName}</p>}
        {!compact && description && <p className="card-face-description">{description}</p>}
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
