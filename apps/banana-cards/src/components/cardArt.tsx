import type { ReactElement } from "react";
import type { OwnedCardView } from "@/lib/db";

// Real illustrated art for every card, replacing the flat gradient+icon
// placeholder. Everything here is original flat-vector illustration drawn
// as inline SVG - no photos, no generated imagery, and (per the standing
// "no real player names or likeness" instruction) no figure is ever drawn
// with a face or any identifying feature. Player/character figures are
// deliberately faceless silhouettes; team art is an invented monogram
// crest, not a reproduction of any real team's actual logo; the mascot
// figure is an original dancing-banana design, not a copy of any real
// costume. image_path on card_templates stays reserved for a future photo
// pipeline - this is what fills the same slot in the meantime, and unlike
// a placeholder, it's meant to ship.
//
// Four silhouette "poses" cycle across roster cards (batting, pitching,
// sliding, diving) so 12+ player cards don't all look identical. Which
// pose a given card gets is derived deterministically from its title (a
// tiny string hash), not randomized, so a card looks the same on every
// render/visit.

function hashPose(seed: string, count: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % count;
}

// --- Roster: faceless action silhouette, one of four poses ---

function BatterSilhouette() {
  return (
    <path
      d="M50 78c-3-10-1-19 5-24l3-16-8-14 6-4 9 14 14-2 3-6 6 3-4 9-16 3-2 13c6 3 10 9 11 17l3 12H50z"
      fill="currentColor"
    />
  );
}

function PitcherSilhouette() {
  return (
    <path
      d="M46 20l10-6 4 5-8 5 12 10 14-4 3 6-16 6-13-9-7 10c5 4 7 10 7 18l2 13H43l1-15c-4-2-6-6-6-11 0-7 3-13 8-16z"
      fill="currentColor"
    />
  );
}

function SliderSilhouette() {
  return (
    <path
      d="M20 70l14-10 8 2 10-9 6 2-3 8-11 9-7-2-13 9-4 6-9-2z M60 47a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"
      fill="currentColor"
    />
  );
}

function DiverSilhouette() {
  return (
    <path
      d="M22 52l16-6 10 4 20-14 5 5-21 16-11-4-15 6-3 12-8-1z M66 26a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"
      fill="currentColor"
    />
  );
}

const POSES = [BatterSilhouette, PitcherSilhouette, SliderSilhouette, DiverSilhouette];

function RosterArt({ seed }: { seed: string }) {
  const Pose = POSES[hashPose(seed, POSES.length)];
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <circle cx="50" cy="50" r="46" className="card-art-ring" />
      <Pose />
    </svg>
  );
}

// --- Team: an invented monogram crest, not any real club's actual logo ---

function TeamArt({ title }: { title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path d="M50 6l36 14v26c0 26-16 42-36 48C30 88 14 72 14 46V20z" className="card-art-ring" />
      <path d="M50 14l28 11v21c0 21-12 33-28 38-16-5-28-17-28-38V25z" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <text x="50" y="60" textAnchor="middle" className="card-art-monogram">
        {initials}
      </text>
    </svg>
  );
}

// --- Venue: a stadium bowl skyline under a banana crescent moon ---

function VenueArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path
        d="M50 70c-24 0-40-13-40-13v-10c8 8 22 13 40 13s32-5 40-13v10s-16 13-40 13z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M14 47c8 9 22 15 36 15s28-6 36-15" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <rect x="16" y="18" width="4" height="24" fill="currentColor" opacity="0.8" />
      <rect x="80" y="18" width="4" height="24" fill="currentColor" opacity="0.8" />
      <circle cx="18" cy="16" r="4" fill="currentColor" />
      <circle cx="82" cy="16" r="4" fill="currentColor" />
      <path d="M62 20a10 10 0 1 1-4-18 13 13 0 1 0 4 18z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

// --- Character: an original dancing-banana mascot figure, not a copy of
// any real team's mascot costume ---

function MascotArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path
        d="M50 18c10 0 16 8 16 20 0 16-8 26-16 34-8-8-16-18-16-34 0-12 6-20 16-20z"
        fill="currentColor"
      />
      <path d="M38 26c-4-6-4-14 2-18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 58l-14 10M70 58l14 10" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M40 82l-8 12M60 82l8 12" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="44" cy="40" r="2.4" className="card-art-dot" />
      <circle cx="56" cy="40" r="2.4" className="card-art-dot" />
      <path d="M42 48c3 3 13 3 16 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// --- Moment: a freeze-frame flash burst around an action silhouette ---

function MomentArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const x2 = 50 + Math.cos(angle) * 46;
        const y2 = 50 + Math.sin(angle) * 46;
        const x1 = 50 + Math.cos(angle) * 32;
        const y1 = 50 + Math.sin(angle) * 32;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        );
      })}
      <circle cx="50" cy="50" r="26" className="card-art-ring" />
      <DiverSilhouette />
    </svg>
  );
}

// --- Milestone: trophy with a celebratory ribbon burst ---

function MilestoneArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path
        d="M38 18h24v14c0 9-5 16-12 16s-12-7-12-16z"
        fill="currentColor"
      />
      <path d="M38 22c-8 0-13 5-13 11s6 9 12 9" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M62 22c8 0 13 5 13 11s-6 9-12 9" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="46" y="48" width="8" height="10" fill="currentColor" />
      <path d="M32 82l14-16 4 6 4-6 14 16-18-6z" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

// --- Trade-only: two exchanging arrows around a ticket stub ---

function TradeOnlyArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path d="M20 40h44l-10-10 6-6 20 20-20 20-6-6 10-10H20z" fill="currentColor" opacity="0.9" />
      <path d="M80 60H36l10 10-6 6-20-20 20-20 6 6-10 10h44z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

// --- Special items: five specific props, matched by title keyword ---

function CapeArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path d="M50 14c-10 0-18 6-22 14l6 44c4-8 10-12 16-12s12 4 16 12l6-44c-4-8-12-14-22-14z" fill="currentColor" />
      <path d="M40 22h20v8H40z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function HelmetArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <circle cx="50" cy="46" r="26" fill="currentColor" />
      <circle cx="50" cy="46" r="16" className="card-art-visor" />
      <rect x="30" y="66" width="40" height="10" rx="5" fill="currentColor" opacity="0.75" />
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={50 + Math.cos((i / 5) * Math.PI * 2) * 30} y1={20 + Math.sin((i / 5) * Math.PI * 2) * 30} x2={50 + Math.cos((i / 5) * Math.PI * 2) * 38} y2={20 + Math.sin((i / 5) * Math.PI * 2) * 38} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      ))}
    </svg>
  );
}

function StiltsArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <path d="M38 14l-10 74M62 14l10 74" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="30" y="52" width="12" height="8" rx="2" fill="currentColor" />
      <rect x="58" y="52" width="12" height="8" rx="2" fill="currentColor" />
      <path d="M34 14h30" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function UnicycleArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <circle cx="50" cy="62" r="24" className="card-art-ring" />
      <circle cx="50" cy="62" r="4" fill="currentColor" />
      <path d="M50 38V22M40 22h20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="42" y="16" width="16" height="8" rx="3" fill="currentColor" />
      <path d="M32 50l-10-4M68 50l10-4" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function CowboyHatArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <ellipse cx="50" cy="62" rx="38" ry="10" fill="currentColor" />
      <path d="M32 60c0-16 8-28 18-28s18 12 18 28" fill="currentColor" opacity="0.85" />
      <path d="M32 60c8-6 28-6 36 0" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5" />
    </svg>
  );
}

function GiftArt() {
  return (
    <svg viewBox="0 0 100 100" className="card-art-svg" aria-hidden>
      <rect x="26" y="44" width="48" height="34" rx="3" fill="currentColor" />
      <rect x="26" y="44" width="48" height="10" fill="currentColor" opacity="0.6" />
      <rect x="46" y="44" width="8" height="34" fill="currentColor" opacity="0.5" />
      <path d="M50 44c-6-14-22-14-18-2 2 4 10 4 18 2zM50 44c6-14 22-14 18-2-2 4-10 4-18 2z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

const ITEM_MATCHERS: [RegExp, () => ReactElement][] = [
  [/cape/i, CapeArt],
  [/helmet/i, HelmetArt],
  [/stilts/i, StiltsArt],
  [/unicycle/i, UnicycleArt],
  [/cowboy|hat/i, CowboyHatArt],
];

function SpecialItemArt({ title }: { title: string }) {
  const match = ITEM_MATCHERS.find(([re]) => re.test(title));
  const Art = match ? match[1] : GiftArt;
  return <Art />;
}

/**
 * Renders the right illustrated scene for a card. `seed` should be a stable,
 * unique-per-card string (title is fine) used only to pick a deterministic
 * pose variant for roster cards - never randomized, so a card looks the
 * same every time it's rendered.
 */
export function CardArt({ type, title }: { type: OwnedCardView["type"]; title: string }) {
  switch (type) {
    case "roster":
      return <RosterArt seed={title} />;
    case "team":
      return <TeamArt title={title} />;
    case "venue":
      return <VenueArt />;
    case "character":
      return <MascotArt />;
    case "moment":
      return <MomentArt />;
    case "milestone":
      return <MilestoneArt />;
    case "trade_only":
      return <TradeOnlyArt />;
    case "special_item":
      return <SpecialItemArt title={title} />;
    default:
      return null;
  }
}
