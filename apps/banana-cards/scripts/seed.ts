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
import { eventsRepo, cardTemplatesRepo, redemptionCodesRepo, type CardTemplateRow } from "../src/lib/db";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const rawDb = new Database(path.join(dataDir, "banana-cards.sqlite"));

console.log("Wiping existing data...");
rawDb.exec(`
  DELETE FROM trade_items;
  DELETE FROM trades;
  DELETE FROM card_instances;
  DELETE FROM redemption_codes;
  DELETE FROM card_templates;
  DELETE FROM events;
  DELETE FROM sessions;
  DELETE FROM login_codes;
  DELETE FROM fans;
`);
rawDb.close();

const now = new Date().toISOString();

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
  description: "Wherever he's playing, he's dancing first.",
  playerName: "Handshake",
  createdAt: now,
});

const momentTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: momentTemplateId,
  type: "moment",
  title: "Behind-the-back catch",
  description: "The bit everyone screamed about at Grayson Stadium, 9/12.",
  eventId: completedEventId,
  createdAt: now,
});

const characterTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: characterTemplateId,
  type: "character",
  title: "Banana Baby",
  description: "Honored every single game. This one's from 9/12.",
  eventId: completedEventId,
  createdAt: now,
});

const tradeOnlyTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: tradeOnlyTemplateId,
  type: "trade_only",
  title: "Yellow Tux",
  description: "Never redeemed directly - only ever changes hands by trade.",
  createdAt: now,
});

const milestoneTemplateId = randomUUID();
cardTemplatesRepo.create({
  id: milestoneTemplateId,
  type: "milestone",
  title: "First Home Run of the Season",
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
    stats: t.stats,
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

console.log("\nSeeded. Unredeemed codes to try at /redeem:");
for (const { code } of codes) console.log(`  ${code}`);
console.log(
  `\n(trade_only template "${tradeOnlyTemplateId}" and the Rally Kazoo, Tutu of Triumph, and ` +
    `Breakdancing First-Base Coach templates were seeded with no code - not directly redeemable, by design)`
);
