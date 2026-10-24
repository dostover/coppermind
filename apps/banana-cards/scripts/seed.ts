// Dev-only: wipes and reseeds the local SQLite db with fake events, card
// templates, and a handful of unredeemed codes, so there's something real to
// test the redemption/collection/trade flows against. Never run against a
// database that holds real fan data - it deletes everything first.
//
// Usage: npm run seed
//
// Card content below is entirely fictional mock content for exercising the
// app: team names match the real Banana Ball Championship League and
// stadiums are real tour stops (both are public facts about the league, not
// private individuals), but every stat is invented for demo purposes, and
// every player is a fictional nickname-only persona - no real player names
// or likeness, per the standing instruction for this content.

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  eventsRepo,
  cardTemplatesRepo,
  redemptionCodesRepo,
  fansRepo,
  tradesRepo,
  setsRepo,
  dropsRepo,
  ensureSystemTemplates,
  type CardTemplateRow,
} from "../src/lib/db";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const rawDb = new Database(path.join(dataDir, "banana-cards.sqlite"));

console.log("Wiping existing data...");
rawDb.exec(`
  DELETE FROM drop_claims;
  DELETE FROM gifts;
  DELETE FROM trade_items;
  DELETE FROM trades;
  DELETE FROM card_instances;
  DELETE FROM drops;
  DELETE FROM redemption_codes;
  DELETE FROM card_set_items;
  DELETE FROM card_sets;
  DELETE FROM card_templates;
  DELETE FROM events;
  DELETE FROM sessions;
  DELETE FROM login_codes;
  DELETE FROM fans;
`);
rawDb.close();

// The pass-it-on and welcome cards are created by the app itself, not by a
// redemption code - put them back after the wipe above removed them.
ensureSystemTemplates();

const now = new Date().toISOString();

// Card art: flat, representational illustrations in public/cards/ (the same
// ones as the print-sheet design). No real likenesses, logos or signage -
// teams are drawn from their names and themes, stadiums from their shape.
const ART: Record<string, string> = {
  Handshake: "handshake",
  "Behind-the-back catch": "behind-the-back-catch",
  "Banana Baby": "banana-baby",
  "Yellow Tux": "yellow-tux",
  "First Home Run of the Season": "first-home-run",
  "Grayson Stadium": "grayson-stadium",
  "Truist Park": "truist-park",
  "Wrigley Field": "wrigley-field",
  "Fenway Park": "fenway-park",
  "Memorial Stadium": "memorial-stadium",
  "Savannah Bananas": "savannah-bananas",
  "Party Animals": "party-animals",
  Firefighters: "firefighters",
  "Texas Tailgaters": "texas-tailgaters",
  "Loco Beach Coconuts": "loco-beach-coconuts",
  "Indianapolis Clowns": "indianapolis-clowns",
  Static: "static",
  Marmalade: "marmalade",
  Sizzle: "sizzle",
  "Two-Step": "two-step",
  Driftwood: "driftwood",
  Ringmaster: "ringmaster",
  "The Home Run Cape": "home-run-cape",
  "The Pinch-Hit Stilts": "pinch-hit-stilts",
  "The Rally Kazoo": "rally-kazoo",
  "Tutu of Triumph": "tutu-of-triumph",
  "Dancing Umpire": "dancing-umpire",
  "Banana Nanas": "banana-nanas",
  "Breakdancing First-Base Coach": "breakdancing-coach",
  "Watched Live: Bananas vs Firefighters": "stream-firefighters",
  "Watched Live: Bananas vs Party Animals": "stream-party-animals",
  "Static's Dugout Selfie": "static-selfie",
  "Pink Out Night": "pink-out",
};
function art(title: string): string | undefined {
  return ART[title] ? `/cards/${ART[title]}.svg` : undefined;
}

console.log("Seeding events...");
const completedEventId = randomUUID();
eventsRepo.create({
  id: completedEventId,
  team: "Savannah Bananas",
  opponent: "Party Animals",
  venue: "Grayson Stadium",
  eventDate: "2026-09-12",
  createdAt: now,
});

const upcomingEventId = randomUUID();
eventsRepo.create({
  id: upcomingEventId,
  team: "Savannah Bananas",
  opponent: "Firefighters",
  venue: "Grayson Stadium",
  eventDate: "2026-09-25",
  createdAt: now,
});

console.log("Seeding original card templates...");
const rosterTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: rosterTemplateId,
  type: "roster",
  title: "Handshake",
  imagePath: art("Handshake"),
  description: "Wherever he's playing, he's dancing first.",
  playerName: "Handshake",
  createdAt: now,
});

const momentTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: momentTemplateId,
  type: "moment",
  title: "Behind-the-back catch",
  imagePath: art("Behind-the-back catch"),
  description: "The bit everyone screamed about at Grayson Stadium, 9/12.",
  eventId: completedEventId,
  createdAt: now,
});

const characterTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: characterTemplateId,
  type: "character",
  title: "Banana Baby",
  imagePath: art("Banana Baby"),
  description: "Honored every single game. This one's from 9/12.",
  perk: "A printable Banana Baby certificate from the 9/12 game",
  eventId: completedEventId,
  createdAt: now,
});

const tradeOnlyTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: tradeOnlyTemplateId,
  type: "trade_only",
  title: "Yellow Tux",
  imagePath: art("Yellow Tux"),
  description: "Never redeemed directly - only ever changes hands by trade.",
  createdAt: now,
});

const milestoneTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: milestoneTemplateId,
  type: "milestone",
  title: "First Home Run of the Season",
  imagePath: art("First Home Run of the Season"),
  description: "Commemorates the record-setting swing.",
  eventId: completedEventId,
  createdAt: now,
});

// --- New content below: stadiums, teams, players, special items, and a few
// more recurring bits. Each entry optionally carries a redemption code; the
// ones without one are seeded as already-in-circulation cards (reachable via
// trade only), the same way "Yellow Tux" above has always worked.

type SeedTemplate = {
  id: string;
  type: CardTemplateRow["type"];
  title: string;
  description: string;
  playerName?: string;
  stats?: Record<string, string | number>;
  perk?: string;
  code?: string;
};

console.log("Seeding stadium cards...");
const venues: SeedTemplate[] = [
  {
    id: randomUUID(),
    type: "venue",
    title: "Grayson Stadium",
    description:
      "Where Banana Ball started, and still the Bananas' home turf between tour stops.",
    stats: { Location: "Savannah, GA", Capacity: "~4,000" },
    code: "BB-VENUE-001",
  },
  {
    id: randomUUID(),
    type: "venue",
    title: "Truist Park",
    description: "A regular-season MLB ballpark that opens its gates for a Banana Ball night.",
    stats: { Location: "Atlanta, GA", Capacity: "~41,000" },
    code: "BB-VENUE-002",
  },
  {
    id: randomUUID(),
    type: "venue",
    title: "Wrigley Field",
    description: "One of the sport's most historic parks, taken over for a Banana Ball run.",
    stats: { Location: "Chicago, IL", Capacity: "~41,000" },
    code: "BB-VENUE-003",
  },
  {
    id: randomUUID(),
    type: "venue",
    title: "Fenway Park",
    description: "The oldest ballpark in the majors hosted its first Banana Ball game in 2024.",
    stats: { Location: "Boston, MA", Capacity: "~37,000" },
    code: "BB-VENUE-004",
  },
  {
    id: randomUUID(),
    type: "venue",
    title: "Memorial Stadium",
    description:
      "A football stadium turned into the biggest crowd Banana Ball has ever played in front of.",
    stats: { Location: "Lincoln, NE", Capacity: "~85,000" },
    code: "BB-VENUE-005",
  },
];

console.log("Seeding team cards...");
// Mock exhibition-season stats, invented for this app - not real BBCL
// standings. Every team's W+L totals the same mock 43-game slate, and
// DIFF always equals PF-PA, so the numbers hang together the way a real
// scoreboard would even though they're made up. TRICKS deliberately doesn't
// track wins - it's a separate axis on purpose, per the value model's
// "tricks add personality, not a scoreboard edge" framing.
const teams: SeedTemplate[] = [
  {
    id: randomUUID(),
    type: "team",
    title: "Savannah Bananas",
    description: "The original Banana Ball club, and still the team every other roster wants to beat.",
    stats: { W: 34, L: 9, PCT: ".791", PF: 512, PA: 398, DIFF: "+114", TRICKS: 61 },
    code: "BB-TEAM-001",
  },
  {
    id: randomUUID(),
    type: "team",
    title: "Party Animals",
    description:
      "The Bananas' longest-running rival, famous for pink uniforms and a bench that never sits still.",
    stats: { W: 27, L: 16, PCT: ".628", PF: 470, PA: 431, DIFF: "+39", TRICKS: 54 },
    code: "BB-TEAM-002",
  },
  {
    id: randomUUID(),
    type: "team",
    title: "Firefighters",
    description: "A fire-themed club that turns every scoring rally into a five-alarm entrance.",
    stats: { W: 25, L: 18, PCT: ".581", PF: 455, PA: 440, DIFF: "+15", TRICKS: 47 },
    code: "BB-TEAM-003",
  },
  {
    id: randomUUID(),
    type: "team",
    title: "Texas Tailgaters",
    description: "Denim, tailgate energy, and a lineup that plays as loose as it looks.",
    stats: { W: 22, L: 21, PCT: ".512", PF: 448, PA: 452, DIFF: "-4", TRICKS: 58 },
    code: "BB-TEAM-004",
  },
  {
    id: randomUUID(),
    type: "team",
    title: "Loco Beach Coconuts",
    description:
      "A tropical expansion club making its BBCL debut - still finding its footing, never short on flair.",
    stats: { W: 19, L: 24, PCT: ".442", PF: 420, PA: 460, DIFF: "-40", TRICKS: 66 },
    code: "BB-TEAM-005",
  },
  {
    id: randomUUID(),
    type: "team",
    title: "Indianapolis Clowns",
    description: "A BBCL revival built on showmanship first - the record is still catching up to the routine.",
    stats: { W: 15, L: 28, PCT: ".349", PF: 388, PA: 470, DIFF: "-82", TRICKS: 70 },
    code: "BB-TEAM-006",
  },
];

console.log("Seeding player cards...");
// Fictional nickname-only personas (matching the "Handshake" precedent
// above) with regular baseball stats - explicitly not real player names or
// likeness, per instruction. One per team, mixing hitters and pitchers.
const players: SeedTemplate[] = [
  {
    id: randomUUID(),
    type: "roster",
    title: "Static",
    playerName: "Static",
    description:
      "Leadoff hitter for the Savannah Bananas, known for jolting the dugout awake before the first pitch even lands.",
    stats: { AVG: ".342", HR: 6, RBI: 31, SB: 41 },
    code: "BB-PLAYER-001",
  },
  {
    id: randomUUID(),
    type: "roster",
    title: "Marmalade",
    playerName: "Marmalade",
    description: "Cleanup hitter for the Party Animals - a swing built to spread the ball everywhere.",
    stats: { AVG: ".278", HR: 24, RBI: 71, SB: 3 },
    code: "BB-PLAYER-002",
  },
  {
    id: randomUUID(),
    type: "roster",
    title: "Sizzle",
    playerName: "Sizzle",
    description: "Closer for the Firefighters. Comes in throwing heat, literally and otherwise.",
    stats: { W: 4, L: 2, SV: 19, ERA: "1.87", SO: 61 },
    code: "BB-PLAYER-003",
  },
  {
    id: randomUUID(),
    type: "roster",
    title: "Two-Step",
    playerName: "Two-Step",
    description: "Switch-hitting shortstop for the Texas Tailgaters who dances between every pitch.",
    stats: { AVG: ".311", HR: 9, RBI: 44, SB: 15 },
    code: "BB-PLAYER-004",
  },
  {
    id: randomUUID(),
    type: "roster",
    title: "Driftwood",
    playerName: "Driftwood",
    description:
      "First baseman for the Loco Beach Coconuts. A slow, deceptive swing that somehow keeps finding the gaps.",
    stats: { AVG: ".289", HR: 15, RBI: 58, SB: 2 },
    code: "BB-PLAYER-005",
  },
  {
    id: randomUUID(),
    type: "roster",
    title: "Ringmaster",
    playerName: "Ringmaster",
    description:
      "Starting pitcher for the Indianapolis Clowns, famous for a windup with more acts than the bullpen has arms.",
    stats: { W: 8, L: 7, ERA: "3.02", SO: 94, IP: 121 },
    code: "BB-PLAYER-006",
  },
];

console.log("Seeding special item cards...");
// Gimmick props, not player content - flavor only, no stats. Two are
// directly redeemable; the other two are seeded already in circulation
// (trade-only in practice), the same pattern as "Yellow Tux" above.
const specialItems: SeedTemplate[] = [
  {
    id: randomUUID(),
    type: "special_item",
    title: "The Home Run Cape",
    perk: "A slow-motion clip of the cape's trip around the bases",
    description:
      "Draped on whoever's rounding the bases after a long ball. More theater than equipment, and everyone wants a turn in it.",
    code: "BB-ITEM-001",
  },
  {
    id: randomUUID(),
    type: "special_item",
    title: "The Pinch-Hit Stilts",
    description: "Brought out for one novelty at-bat a game. Strike zone included; balance not guaranteed.",
    code: "BB-ITEM-002",
  },
  {
    id: randomUUID(),
    type: "special_item",
    title: "The Rally Kazoo",
    perk: "The Rally Kazoo as a ringtone",
    description:
      "Passed hand to hand around the dugout during a two-out rally. The tone gets worse the longer the inning goes.",
  },
  {
    id: randomUUID(),
    type: "special_item",
    title: "Tutu of Triumph",
    description: "Worn by the last player to make an error, and retired the moment someone else claims the title.",
  },
];

console.log("Seeding more character/bit cards...");
const characters: SeedTemplate[] = [
  {
    id: randomUUID(),
    type: "character",
    title: "Dancing Umpire",
    perk: "A 30-second clip of the full strike-three routine",
    description: "The strike-three call everyone remembers longer than the pitch that earned it.",
    code: "BB-CHAR-002",
  },
  {
    id: randomUUID(),
    type: "character",
    title: "Banana Nanas",
    description:
      "The senior dance troupe that owns the space between innings - no bit in the ballpark gets a bigger pop.",
    code: "BB-CHAR-003",
  },
  {
    id: randomUUID(),
    type: "character",
    title: "Breakdancing First-Base Coach",
    description: "Coaches the runner and hypes the crowd in the same motion, sometimes in the same breath.",
  },
];

const newTemplates = [...venues, ...teams, ...players, ...specialItems, ...characters];
for (const t of newTemplates) {
  cardTemplatesRepo.create({
    id: t.id,
    type: t.type,
    title: t.title,
    description: t.description,
    playerName: t.playerName,
    imagePath: art(t.title),
    stats: t.stats,
    perk: t.perk,
    createdAt: now,
  });
}

console.log("Issuing unredeemed codes...");
// Two codes each for two fans (BB-*-001 / BB-*-002) so there's something on
// both sides to test the trade flow with, not just redemption.
const codes: { code: string; template: string }[] = [
  { code: "BB-ROSTER-001", template: rosterTemplateId },
  { code: "BB-MOMENT-001", template: momentTemplateId },
  { code: "BB-CHAR-001", template: characterTemplateId },
  { code: "BB-ROSTER-002", template: rosterTemplateId },
  { code: "BB-MILESTONE-001", template: milestoneTemplateId },
  ...newTemplates
    .filter((t): t is SeedTemplate & { code: string } => Boolean(t.code))
    .map((t) => ({ code: t.code, template: t.id })),
];

for (const { code, template } of codes) {
  redemptionCodesRepo.issue({
    id: randomUUID(),
    code,
    templateId: template,
    eventId: template === momentTemplateId || template === characterTemplateId ? completedEventId : undefined,
    issuedVia: "staff",
    createdAt: now,
  });
}

console.log("Seeding stream and social drop cards...");
// Beyond the ballpark (see claude/card-value-model.md): cards for fans who
// watch a game live on a stream, and cards players and teams drop on their
// own social channels. They're only ever handed out through a drop (no
// redemption code), and each is labeled with where it came from.
const streamFirefightersTemplateId = randomUUID();
const streamPartyAnimalsTemplateId = randomUUID();
const staticSelfieTemplateId = randomUUID();
const pinkOutTemplateId = randomUUID();
const dropTemplates: { id: string; type: CardTemplateRow["type"]; title: string; description: string; playerName?: string; eventId?: string }[] = [
  {
    id: streamFirefightersTemplateId,
    type: "moment",
    title: "Watched Live: Bananas vs Firefighters",
    description: "For everyone who tuned in while it happened. Only claimable during the live stream.",
    eventId: upcomingEventId,
  },
  {
    id: streamPartyAnimalsTemplateId,
    type: "moment",
    title: "Watched Live: Bananas vs Party Animals",
    description: "For everyone watching the 9/12 game live, wherever they were.",
    eventId: completedEventId,
  },
  {
    id: staticSelfieTemplateId,
    type: "roster",
    title: "Static's Dugout Selfie",
    description: "Posted by Static before first pitch, for everyone following along.",
    playerName: "Static",
  },
  {
    id: pinkOutTemplateId,
    type: "moment",
    title: "Pink Out Night",
    description: "Dropped by the Party Animals for everyone who wore pink, in the stands or at home.",
  },
];
for (const t of dropTemplates) {
  cardTemplatesRepo.create({ ...t, imagePath: art(t.title), createdAt: now });
}

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const streamFirefightersDrop = randomUUID();
const streamPartyAnimalsDrop = randomUUID();
const staticSelfieDrop = randomUUID();
const pinkOutDrop = randomUUID();
dropsRepo.create({
  id: randomUUID(),
  token: streamFirefightersDrop,
  kind: "stream",
  title: "Bananas vs Firefighters",
  sourceName: "Banana Ball stream",
  templateId: streamFirefightersTemplateId,
  eventId: upcomingEventId,
  isLive: true, // "live now" in the demo - end it from the drop console
  createdAt: now,
});
dropsRepo.create({
  id: randomUUID(),
  token: streamPartyAnimalsDrop,
  kind: "stream",
  title: "Bananas vs Party Animals · 9/12",
  sourceName: "Banana Ball stream",
  templateId: streamPartyAnimalsTemplateId,
  eventId: completedEventId,
  isLive: true, // ended below, once a demo fan has claimed it during the "game"
  createdAt: now,
});
dropsRepo.create({
  id: randomUUID(),
  token: staticSelfieDrop,
  kind: "social",
  title: "Dugout selfie",
  sourceName: "Static",
  templateId: staticSelfieTemplateId,
  closesAt: inDays(7),
  createdAt: now,
});
dropsRepo.create({
  id: randomUUID(),
  token: pinkOutDrop,
  kind: "social",
  title: "Pink Out Night",
  sourceName: "Party Animals",
  templateId: pinkOutTemplateId,
  closesAt: inDays(7),
  createdAt: now,
});

console.log("Seeding sets...");
// Completion value (see claude/card-value-model.md): themed groups of cards
// that unlock a small, real perk when a fan holds one of each. Every card in
// every set can be redeemed or traded for - none is buy-only - and a card can
// sit in more than one set (Banana Baby is in two). The perks are example
// content for the demo, not commitments.
const sets: {
  title: string;
  description: string;
  perkTitle: string;
  perkDescription: string;
  templateIds: string[];
}[] = [
  {
    title: "One Night at Grayson · 9/12",
    description: "Everything that happened on one night at Grayson Stadium.",
    perkTitle: "The full highlight reel",
    perkDescription: "Every bit from 9/12 at Grayson Stadium in one video, playable right from your collection.",
    templateIds: [momentTemplateId, characterTemplateId, milestoneTemplateId],
  },
  {
    title: "Bits and Characters",
    description: "The people who make the show the show.",
    perkTitle: "Pregame bit from the rail",
    perkDescription: "Watch one pregame bit from the field-level rail. Show this at Guest Services when you arrive.",
    templateIds: [characterTemplateId, ...characters.map((c) => c.id)],
  },
  {
    title: "The Tour",
    description: "One card for every ballpark on the tour.",
    perkTitle: "Big-screen shoutout",
    perkDescription: "Your name on the big screen at your next game. Show this at Guest Services when you arrive.",
    templateIds: venues.map((v) => v.id),
  },
  {
    title: "The League",
    description: "Every team in the Banana Ball Championship League.",
    perkTitle: "Pick-your-squad badge",
    perkDescription: "Choose your team and show its badge next to your name whenever you trade.",
    templateIds: teams.map((t) => t.id),
  },
  {
    title: "The Roster",
    description: "One player from every club, plus Handshake.",
    perkTitle: "Hello from the dugout",
    perkDescription: "A short video hello from a player, delivered to your collection.",
    templateIds: [rosterTemplateId, ...players.map((pl) => pl.id)],
  },
  {
    title: "The Props Department",
    description: "The gear behind the gags.",
    perkTitle: "Try on a prop",
    perkDescription: "A photo wearing the Home Run Cape or the Yellow Tux at the merch stand.",
    templateIds: [...specialItems.map((i) => i.id), tradeOnlyTemplateId],
  },
  {
    title: "Watched Live",
    description: "Cards for watching Banana Ball live, wherever you are.",
    perkTitle: "Your name in the fan shoutout",
    perkDescription: "Your name scrolls across the screen during a future live stream.",
    templateIds: [streamFirefightersTemplateId, streamPartyAnimalsTemplateId],
  },
  {
    title: "Following Along",
    description: "Cards dropped by players and teams on their own channels.",
    perkTitle: "A shoutout from a player",
    perkDescription: "A player thanks you by name in a post on their channel.",
    templateIds: [staticSelfieTemplateId, pinkOutTemplateId],
  },
];
sets.forEach((set, i) =>
  setsRepo.create({ id: randomUUID(), ...set, sortOrder: i, createdAt: now })
);

console.log("\nSeeded. Unredeemed codes to try at /redeem:");
for (const { code } of codes) console.log(`  ${code}`);
console.log(
  `\n(trade_only template "${tradeOnlyTemplateId}" and the Rally Kazoo, Tutu of Triumph, and ` +
    `Breakdancing First-Base Coach templates were seeded with no code - not directly redeemable, by design)`
);

// --- Demo fan personas: a few fans with pre-populated collections, so
// there's something real to click through immediately after `npm run seed`
// without first working through the redeem flow by hand. Sign in as any of
// them at /sign-in with the email below - request-code has no real email
// service wired up yet (see src/app/api/auth/request-code/route.ts), so it
// echoes the one-time code back as devCode and logs it, which is all you
// need to complete sign-in as that persona.

type Persona = { id: string; displayName: string; email: string };

const peelMasterFlex: Persona = {
  id: randomUUID(),
  displayName: "Peel Master Flex",
  email: "peelmaster@example.com",
};
const rookieNanas: Persona = {
  id: randomUUID(),
  displayName: "Rookie Nanas",
  email: "rookienanas@example.com",
};
const sluggo: Persona = { id: randomUUID(), displayName: "Sluggo", email: "sluggo@example.com" };
const zesty: Persona = { id: randomUUID(), displayName: "Zesty", email: "zesty@example.com" };

console.log("\nSeeding demo fan personas...");
for (const p of [peelMasterFlex, rookieNanas, sluggo, zesty]) {
  fansRepo.create({ id: p.id, displayName: p.displayName, email: p.email, createdAt: now });
}

// Issues a fresh, dedicated code for `templateId` and redeems it straight
// into `fan`'s collection, via the same redemptionCodesRepo.redeem() path a
// real fan's redemption hits - not a raw insert, so a seeded persona's cards
// are exactly as valid as a genuinely redeemed one. Codes are "DEMO-GRANT-"
// prefixed and consumed the instant they're issued, so they never show up
// in (or collide with) the "codes to try" list printed above.
let demoGrantCount = 0;
function grantCard(fan: Persona, templateId: string): string {
  demoGrantCount += 1;
  const code = `DEMO-GRANT-${String(demoGrantCount).padStart(3, "0")}`;
  redemptionCodesRepo.issue({ id: randomUUID(), code, templateId, issuedVia: "staff", createdAt: now });
  return redemptionCodesRepo.redeem({ code, fanId: fan.id, newInstanceId: randomUUID(), redeemedAt: now })
    .instance.id;
}

// Peel Master Flex: the collector - a broad, mixed collection so the
// collection view's type filters, source filters, and stats all have
// several categories to show at once.
grantCard(peelMasterFlex, rosterTemplateId);
grantCard(peelMasterFlex, teams[0].id); // Savannah Bananas
grantCard(peelMasterFlex, teams[1].id); // Party Animals
grantCard(peelMasterFlex, players[0].id); // Static
const peelMasterFlexMarmalade = grantCard(peelMasterFlex, players[1].id); // Marmalade
grantCard(peelMasterFlex, venues[0].id); // Grayson Stadium
grantCard(peelMasterFlex, specialItems[0].id); // The Home Run Cape
grantCard(peelMasterFlex, characters[0].id); // Dancing Umpire
grantCard(peelMasterFlex, milestoneTemplateId);
// With the moment and Banana Baby, Peel Master Flex has finished the
// "One Night at Grayson" set - so an unlocked set perk is visible right
// away without first playing through a redemption or trade.
grantCard(peelMasterFlex, momentTemplateId);
grantCard(peelMasterFlex, characterTemplateId);

// Rookie Nanas: a brand-new fan with just a couple of starter cards - the
// realistic common case, not a collector's account.
grantCard(rookieNanas, momentTemplateId);
grantCard(rookieNanas, characters[1].id); // Banana Nanas

// Sluggo: a mid-size collection, and one side of a trade that's already
// gone through (below), so acquired_via: 'trade' has something real to
// render, not just redemption.
grantCard(sluggo, teams[2].id); // Firefighters
const sluggoSizzle = grantCard(sluggo, players[2].id); // Sizzle
const sluggoTruist = grantCard(sluggo, venues[1].id); // Truist Park
grantCard(sluggo, specialItems[1].id); // The Pinch-Hit Stilts

// Zesty: a mid-size collection, and the other side of a trade still
// awaiting confirmation, so the "waiting on you" / "waiting on them" states
// on /trade have something to show without a live two-phone demo.
const zestyTwoStep = grantCard(zesty, players[3].id); // Two-Step
grantCard(zesty, teams[3].id); // Texas Tailgaters
grantCard(zesty, venues[2].id); // Wrigley Field

console.log("Seeding a confirmed trade (Sluggo <-> Peel Master Flex)...");
const confirmedTradeId = randomUUID();
tradesRepo.create({
  id: confirmedTradeId,
  fanAId: sluggo.id,
  fanBId: peelMasterFlex.id,
  createdAt: now,
  items: [
    { id: randomUUID(), cardInstanceId: sluggoSizzle, fromFanId: sluggo.id, toFanId: peelMasterFlex.id },
    {
      id: randomUUID(),
      cardInstanceId: peelMasterFlexMarmalade,
      fromFanId: peelMasterFlex.id,
      toFanId: sluggo.id,
    },
  ],
});
tradesRepo.confirm(confirmedTradeId, now);

console.log("Seeding a pending trade (Zesty -> Sluggo, awaiting Sluggo's confirmation)...");
tradesRepo.create({
  id: randomUUID(),
  fanAId: zesty.id,
  fanBId: sluggo.id,
  createdAt: now,
  items: [
    { id: randomUUID(), cardInstanceId: zestyTwoStep, fromFanId: zesty.id, toFanId: sluggo.id },
    { id: randomUUID(), cardInstanceId: sluggoTruist, fromFanId: sluggo.id, toFanId: zesty.id },
  ],
});

console.log("Seeding drop claims (Zesty watched 9/12 live; Sluggo follows Static)...");
// Through the real claim path: Zesty grabs the 9/12 stream card while that
// stream is live, then it ends - so the card exists in circulation (to
// trade for) but can no longer be claimed. Sluggo claims Static's open drop.
dropsRepo.claim({ token: streamPartyAnimalsDrop, fanId: zesty.id, newInstanceId: randomUUID(), now });
dropsRepo.setLive(streamPartyAnimalsDrop, false);
dropsRepo.claim({ token: staticSelfieDrop, fanId: sluggo.id, newInstanceId: randomUUID(), now });

console.log("\nDemo personas ready - request a sign-in code for any of these at /sign-in:");
console.log("  peelmaster@example.com   Peel Master Flex   11 cards, broad mixed collection, 1 set complete");
console.log("  rookienanas@example.com  Rookie Nanas       2 cards, brand-new fan");
console.log("  sluggo@example.com       Sluggo             5 cards, 1 confirmed trade, 1 pending trade to confirm, 1 social drop");
console.log("  zesty@example.com        Zesty              4 cards, 1 pending trade awaiting Sluggo, 1 stream card");
console.log(
  "\nEach persona also holds one Pass It On card (every fan's first redemption grants one) - " +
    "show it from /trade and open the link in a private window to try the new-fan side."
);
