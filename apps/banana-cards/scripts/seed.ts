// Dev-only: wipes and reseeds the local SQLite db with fake events, card
// templates, and a handful of unredeemed codes, so there's something real to
// test the redemption/collection flow against. Never run against a database
// that holds real fan data - it deletes everything first.
//
// Usage: npm run seed

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { eventsRepo, cardTemplatesRepo, redemptionCodesRepo } from "../src/lib/db";

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

console.log("Seeding card templates...");
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

console.log("Issuing unredeemed codes...");
const codes: { code: string; template: string }[] = [
  { code: "BB-ROSTER-001", template: rosterTemplateId },
  { code: "BB-MOMENT-001", template: momentTemplateId },
  { code: "BB-CHAR-001", template: characterTemplateId },
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
console.log(`\n(trade_only template "${tradeOnlyTemplateId}" seeded with no code - not directly redeemable, by design)`);
