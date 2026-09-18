import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

// SQLite for this phase, matching apps/inkwell's approach. Field names and
// shapes intentionally mirror docs/banana-cards/01-data-model.md so that doc
// stays the source of truth for the shape - this file is its implementation,
// not a second design. See claude/card-value-model.md (Banana Cards Claude
// project) for the reasoning behind the decisions this schema encodes:
// single-use redemption codes, strictly single-owner card instances, and
// trades as one atomic mutual-confirmation event rather than a browsable
// offer/listing system (no "cards available to trade" table exists on
// purpose - that would reintroduce the marketplace grammar the value model
// rejects).

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "banana-cards.sqlite"));
db.pragma("journal_mode = WAL");
// SQLite doesn't enforce foreign keys unless told to per-connection.
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS fans (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    team TEXT NOT NULL,
    opponent TEXT,
    venue TEXT NOT NULL,
    event_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming'
      CHECK (status IN ('upcoming', 'live', 'completed')),
    created_at TEXT NOT NULL
  );

  -- card_templates is the *design* of a card (art/story/type) - not any one
  -- fan's copy of it. card_instances (below) is the owned copy. Separating
  -- these is what lets the physical token stay a cheap, generic code: the
  -- rich content lives here, digitally, not on the physical object.
  CREATE TABLE IF NOT EXISTS card_templates (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL
      CHECK (type IN ('roster', 'moment', 'character', 'trade_only', 'milestone')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_path TEXT,
    event_id TEXT REFERENCES events(id),
    player_name TEXT,
    created_at TEXT NOT NULL
  );

  -- One row per physical token issued. v1 issuance is staff/kiosk-only, so
  -- the code's existence is itself the presence proof - verification_method
  -- is reserved for a future geolocation-verified redemption path and is
  -- unused (NULL) in v1.
  CREATE TABLE IF NOT EXISTS redemption_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    template_id TEXT NOT NULL REFERENCES card_templates(id),
    event_id TEXT REFERENCES events(id),
    issued_via TEXT NOT NULL CHECK (issued_via IN ('staff', 'kiosk')),
    status TEXT NOT NULL DEFAULT 'unredeemed'
      CHECK (status IN ('unredeemed', 'redeemed', 'void')),
    redeemed_by_fan_id TEXT REFERENCES fans(id),
    redeemed_at TEXT,
    verification_method TEXT,
    created_at TEXT NOT NULL
  );

  -- A specific fan's specific owned card. owner_fan_id is always exactly one
  -- fan - ownership is strictly single-owner by design, no shared-ownership
  -- table exists. This is the row that moves (owner_fan_id changes) on trade.
  CREATE TABLE IF NOT EXISTS card_instances (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES card_templates(id),
    owner_fan_id TEXT NOT NULL REFERENCES fans(id),
    acquired_via TEXT NOT NULL CHECK (acquired_via IN ('redemption', 'trade')),
    redemption_code_id TEXT REFERENCES redemption_codes(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_card_instances_owner ON card_instances(owner_fan_id);

  -- One atomic trade between two fans, confirmed via mutual QR scan (v1
  -- mechanism). There is no pending-offer state visible to anyone but the
  -- two participants - a trade is created and confirmed together, in person.
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    fan_a_id TEXT NOT NULL REFERENCES fans(id),
    fan_b_id TEXT NOT NULL REFERENCES fans(id),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    method TEXT NOT NULL DEFAULT 'qr_scan' CHECK (method IN ('qr_scan')),
    event_id TEXT REFERENCES events(id),
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    CHECK (fan_a_id != fan_b_id)
  );

  -- The card(s) each side contributes. Supports 1-for-1 (the v1 UX target)
  -- and multi-card trades without a schema change.
  CREATE TABLE IF NOT EXISTS trade_items (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL REFERENCES trades(id),
    card_instance_id TEXT NOT NULL REFERENCES card_instances(id),
    from_fan_id TEXT NOT NULL REFERENCES fans(id),
    to_fan_id TEXT NOT NULL REFERENCES fans(id)
  );

  CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id);
`);

export interface FanRow {
  id: string;
  display_name: string;
  created_at: string;
}

export const fansRepo = {
  create(input: { id: string; displayName: string; createdAt: string }): void {
    db.prepare(`INSERT INTO fans (id, display_name, created_at) VALUES (?, ?, ?)`).run(
      input.id,
      input.displayName,
      input.createdAt
    );
  },

  getById(id: string): FanRow | undefined {
    return db.prepare(`SELECT * FROM fans WHERE id = ?`).get(id) as FanRow | undefined;
  },
};

export interface EventRow {
  id: string;
  team: string;
  opponent: string | null;
  venue: string;
  event_date: string;
  status: "upcoming" | "live" | "completed";
  created_at: string;
}

export const eventsRepo = {
  create(input: {
    id: string;
    team: string;
    opponent?: string;
    venue: string;
    eventDate: string;
    createdAt: string;
  }): void {
    db.prepare(
      `INSERT INTO events (id, team, opponent, venue, event_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.team,
      input.opponent ?? null,
      input.venue,
      input.eventDate,
      input.createdAt
    );
  },

  getById(id: string): EventRow | undefined {
    return db.prepare(`SELECT * FROM events WHERE id = ?`).get(id) as EventRow | undefined;
  },

  listAll(): EventRow[] {
    return db.prepare(`SELECT * FROM events ORDER BY event_date DESC`).all() as EventRow[];
  },
};

export interface CardTemplateRow {
  id: string;
  type: "roster" | "moment" | "character" | "trade_only" | "milestone";
  title: string;
  description: string;
  image_path: string | null;
  event_id: string | null;
  player_name: string | null;
  created_at: string;
}

export const cardTemplatesRepo = {
  create(input: {
    id: string;
    type: CardTemplateRow["type"];
    title: string;
    description: string;
    imagePath?: string;
    eventId?: string;
    playerName?: string;
    createdAt: string;
  }): void {
    db.prepare(
      `INSERT INTO card_templates
         (id, type, title, description, image_path, event_id, player_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.type,
      input.title,
      input.description,
      input.imagePath ?? null,
      input.eventId ?? null,
      input.playerName ?? null,
      input.createdAt
    );
  },

  getById(id: string): CardTemplateRow | undefined {
    return db.prepare(`SELECT * FROM card_templates WHERE id = ?`).get(id) as
      | CardTemplateRow
      | undefined;
  },

  listByType(type: CardTemplateRow["type"]): CardTemplateRow[] {
    return db
      .prepare(`SELECT * FROM card_templates WHERE type = ? ORDER BY created_at DESC`)
      .all(type) as CardTemplateRow[];
  },
};

export interface RedemptionCodeRow {
  id: string;
  code: string;
  template_id: string;
  event_id: string | null;
  issued_via: "staff" | "kiosk";
  status: "unredeemed" | "redeemed" | "void";
  redeemed_by_fan_id: string | null;
  redeemed_at: string | null;
  verification_method: string | null;
  created_at: string;
}

export interface CardInstanceRow {
  id: string;
  template_id: string;
  owner_fan_id: string;
  acquired_via: "redemption" | "trade";
  redemption_code_id: string | null;
  created_at: string;
  updated_at: string;
}

export const redemptionCodesRepo = {
  issue(input: {
    id: string;
    code: string;
    templateId: string;
    eventId?: string;
    issuedVia: RedemptionCodeRow["issued_via"];
    createdAt: string;
  }): void {
    db.prepare(
      `INSERT INTO redemption_codes (id, code, template_id, event_id, issued_via, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.code,
      input.templateId,
      input.eventId ?? null,
      input.issuedVia,
      input.createdAt
    );
  },

  getByCode(code: string): RedemptionCodeRow | undefined {
    return db.prepare(`SELECT * FROM redemption_codes WHERE code = ?`).get(code) as
      | RedemptionCodeRow
      | undefined;
  },

  // Redeems a code and mints the owned card instance in one transaction, so a
  // crash between the two statements can't leave a redeemed code with no
  // resulting card, or a card with no record of which code minted it. Throws
  // if the code doesn't exist or was already redeemed/voided - callers
  // should catch and turn that into a user-facing "this code isn't valid"
  // response rather than a 500.
  redeem(input: {
    code: string;
    fanId: string;
    newInstanceId: string;
    redeemedAt: string;
  }): CardInstanceRow {
    const tx = db.transaction(() => {
      const existing = db
        .prepare(`SELECT * FROM redemption_codes WHERE code = ?`)
        .get(input.code) as RedemptionCodeRow | undefined;

      if (!existing) throw new Error(`Unknown redemption code: ${input.code}`);
      if (existing.status !== "unredeemed") {
        throw new Error(`Redemption code ${input.code} is ${existing.status}, not unredeemed.`);
      }

      db.prepare(
        `UPDATE redemption_codes
         SET status = 'redeemed', redeemed_by_fan_id = ?, redeemed_at = ?
         WHERE id = ?`
      ).run(input.fanId, input.redeemedAt, existing.id);

      db.prepare(
        `INSERT INTO card_instances
           (id, template_id, owner_fan_id, acquired_via, redemption_code_id, created_at, updated_at)
         VALUES (?, ?, ?, 'redemption', ?, ?, ?)`
      ).run(
        input.newInstanceId,
        existing.template_id,
        input.fanId,
        existing.id,
        input.redeemedAt,
        input.redeemedAt
      );

      return db
        .prepare(`SELECT * FROM card_instances WHERE id = ?`)
        .get(input.newInstanceId) as CardInstanceRow;
    });

    return tx();
  },
};

export const cardInstancesRepo = {
  getById(id: string): CardInstanceRow | undefined {
    return db.prepare(`SELECT * FROM card_instances WHERE id = ?`).get(id) as
      | CardInstanceRow
      | undefined;
  },

  listByOwner(fanId: string): CardInstanceRow[] {
    return db
      .prepare(`SELECT * FROM card_instances WHERE owner_fan_id = ? ORDER BY created_at DESC`)
      .all(fanId) as CardInstanceRow[];
  },
};

export interface TradeRow {
  id: string;
  fan_a_id: string;
  fan_b_id: string;
  status: "pending" | "confirmed" | "cancelled";
  method: "qr_scan";
  event_id: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export const tradesRepo = {
  // Starts a trade and records what each side is contributing in one
  // transaction. Ownership does NOT move yet - a trade only changes card
  // ownership once confirm() runs, which requires both fans to be present
  // and scanning together (see card-value-model.md's trade mechanism
  // decision). Until confirmed, this trade is not visible to anyone but the
  // two participants - there is deliberately no browsable "open trades" list.
  create(input: {
    id: string;
    fanAId: string;
    fanBId: string;
    eventId?: string;
    createdAt: string;
    items: { id: string; cardInstanceId: string; fromFanId: string; toFanId: string }[];
  }): void {
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO trades (id, fan_a_id, fan_b_id, event_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(input.id, input.fanAId, input.fanBId, input.eventId ?? null, input.createdAt);

      for (const item of input.items) {
        db.prepare(
          `INSERT INTO trade_items (id, trade_id, card_instance_id, from_fan_id, to_fan_id)
           VALUES (?, ?, ?, ?, ?)`
        ).run(item.id, input.id, item.cardInstanceId, item.fromFanId, item.toFanId);
      }
    });
    tx();
  },

  getById(id: string): TradeRow | undefined {
    return db.prepare(`SELECT * FROM trades WHERE id = ?`).get(id) as TradeRow | undefined;
  },

  // Confirms a pending trade and transfers ownership of every item in one
  // transaction, so a crash partway through can't leave a trade confirmed
  // with only some cards moved. Throws if the trade isn't pending.
  confirm(id: string, confirmedAt: string): void {
    const tx = db.transaction(() => {
      const trade = db.prepare(`SELECT * FROM trades WHERE id = ?`).get(id) as
        | TradeRow
        | undefined;
      if (!trade) throw new Error(`Unknown trade: ${id}`);
      if (trade.status !== "pending") {
        throw new Error(`Trade ${id} is ${trade.status}, not pending.`);
      }

      const items = db
        .prepare(`SELECT * FROM trade_items WHERE trade_id = ?`)
        .all(id) as { card_instance_id: string; to_fan_id: string }[];

      for (const item of items) {
        db.prepare(
          `UPDATE card_instances
           SET owner_fan_id = ?, acquired_via = 'trade', updated_at = ?
           WHERE id = ?`
        ).run(item.to_fan_id, confirmedAt, item.card_instance_id);
      }

      db.prepare(
        `UPDATE trades SET status = 'confirmed', confirmed_at = ? WHERE id = ?`
      ).run(confirmedAt, id);
    });
    tx();
  },

  cancel(id: string): void {
    db.prepare(`UPDATE trades SET status = 'cancelled' WHERE id = ? AND status = 'pending'`).run(
      id
    );
  },
};

// Convenience for callers that need a fresh id/timestamp without importing
// crypto directly (mirrors how apps/inkwell's API routes generate these).
export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
