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

  -- One-time codes emailed to verify a fan's address (see
  -- claude/technical-decisions.md's email + one-time-code auth decision).
  -- Deliberately neutral on delivery format (typed code vs. clickable link
  -- both work against this shape) - that's a UI-layer choice, not a schema
  -- one. Not tied to a fan_id: the fan may not exist yet on first login.
  CREATE TABLE IF NOT EXISTS login_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);

  -- A bearer session token the client stores and sends back
  -- (Authorization: Bearer <token>), not a cookie-only session - chosen so a
  -- future native mobile client can use the exact same auth as the web
  -- reference client, no rewrite needed (see claude/technical-decisions.md's
  -- API-first decision). Long expiry by design: this is the "stay signed in"
  -- session, not re-verified by email on every app open.
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    fan_id TEXT NOT NULL REFERENCES fans(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_fan ON sessions(fan_id);

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

// fans.email was added after the original table shape shipped (auth wasn't
// designed yet) - ALTER TABLE ADD COLUMN, guarded so it's a no-op on a
// database that already has it, matching apps/inkwell's migration pattern.
// Nullable at the schema level (SQLite can't add a NOT NULL column without a
// default), but every fansRepo.create caller is expected to always pass one -
// email is how a fan logs back in, per claude/technical-decisions.md.
const fanColumns = db.prepare(`PRAGMA table_info(fans)`).all() as { name: string }[];
if (!fanColumns.some((c) => c.name === "email")) {
  db.exec(`ALTER TABLE fans ADD COLUMN email TEXT`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fans_email ON fans(email)`);
}

export interface FanRow {
  id: string;
  display_name: string;
  email: string | null;
  created_at: string;
}

export const fansRepo = {
  create(input: { id: string; displayName: string; email: string; createdAt: string }): void {
    db.prepare(
      `INSERT INTO fans (id, display_name, email, created_at) VALUES (?, ?, ?, ?)`
    ).run(input.id, input.displayName, input.email, input.createdAt);
  },

  getById(id: string): FanRow | undefined {
    return db.prepare(`SELECT * FROM fans WHERE id = ?`).get(id) as FanRow | undefined;
  },

  getByEmail(email: string): FanRow | undefined {
    return db.prepare(`SELECT * FROM fans WHERE email = ?`).get(email) as FanRow | undefined;
  },
};

// Emails are normalized to lowercase at this boundary so "Alice@x.com" and
// "alice@x.com" can't create two fans or fail to match an existing one.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface LoginCodeRow {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export const loginCodesRepo = {
  issue(input: { id: string; email: string; code: string; expiresAt: string; createdAt: string }): void {
    db.prepare(
      `INSERT INTO login_codes (id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(input.id, normalizeEmail(input.email), input.code, input.expiresAt, input.createdAt);
  },
};

export interface SessionRow {
  token: string;
  fan_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export const sessionsRepo = {
  create(input: { token: string; fanId: string; createdAt: string; expiresAt: string }): void {
    db.prepare(
      `INSERT INTO sessions (token, fan_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(input.token, input.fanId, input.createdAt, input.expiresAt);
  },

  // Returns the session only if it's neither revoked nor expired - an API
  // route treats any other result as "not signed in", not a distinct error.
  getValidByToken(token: string, now: string): SessionRow | undefined {
    return db
      .prepare(
        `SELECT * FROM sessions
         WHERE token = ? AND revoked_at IS NULL AND expires_at > ?`
      )
      .get(token, now) as SessionRow | undefined;
  },

  revoke(token: string, revokedAt: string): void {
    db.prepare(`UPDATE sessions SET revoked_at = ? WHERE token = ?`).run(revokedAt, token);
  },
};

// Two-phase login: checkCode is a read-only peek so the client can decide
// which screen to show next (an existing fan goes straight through; a new
// email needs a username-selection screen first) without spending the code.
// The code is only actually consumed by whichever finalize call the client
// makes next (completeSignIn or completeRegistration) - both do the
// check-and-consume atomically via the UPDATE's WHERE clause + changes
// count, so two concurrent finalize attempts on the same code can't both
// win (the loser sees "invalid or expired code", not a duplicate session).
export const authRepo = {
  checkCode(input: { email: string; code: string; now: string }): {
    valid: boolean;
    isNewFan: boolean;
  } {
    const email = normalizeEmail(input.email);
    const match = db
      .prepare(
        `SELECT id FROM login_codes
         WHERE email = ? AND code = ? AND consumed_at IS NULL AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(email, input.code, input.now) as { id: string } | undefined;

    if (!match) return { valid: false, isNewFan: false };

    const fan = db.prepare(`SELECT id FROM fans WHERE email = ?`).get(email) as
      | { id: string }
      | undefined;

    return { valid: true, isNewFan: !fan };
  },

  // For an email that already has a fan. Throws if the code can't be
  // consumed (wrong/expired/already used) or if no fan exists for this email
  // (client should have routed to completeRegistration instead).
  completeSignIn(input: {
    email: string;
    code: string;
    now: string;
    sessionExpiresAt: string;
    newSessionToken: string;
  }): { fan: FanRow; session: SessionRow } {
    const email = normalizeEmail(input.email);

    const tx = db.transaction(() => {
      const consumed = consumeCode(email, input.code, input.now);
      if (!consumed) throw new Error("Invalid or expired code.");

      const fan = db.prepare(`SELECT * FROM fans WHERE email = ?`).get(email) as
        | FanRow
        | undefined;
      if (!fan) throw new Error("No account exists for this email yet.");

      const session = createSession(fan.id, input.newSessionToken, input.now, input.sessionExpiresAt);
      return { fan, session };
    });

    return tx();
  },

  // For a brand-new email. Throws if the code can't be consumed, or if a fan
  // was created for this email in the gap since checkCode ran (a second
  // registration attempt for the same email racing this one) - the client
  // should treat that as "actually, sign in instead."
  completeRegistration(input: {
    email: string;
    code: string;
    now: string;
    sessionExpiresAt: string;
    newFanId: string;
    displayName: string;
    newSessionToken: string;
  }): { fan: FanRow; session: SessionRow } {
    const email = normalizeEmail(input.email);

    const tx = db.transaction(() => {
      const consumed = consumeCode(email, input.code, input.now);
      if (!consumed) throw new Error("Invalid or expired code.");

      const existing = db.prepare(`SELECT id FROM fans WHERE email = ?`).get(email);
      if (existing) throw new Error("An account already exists for this email.");

      db.prepare(
        `INSERT INTO fans (id, display_name, email, created_at) VALUES (?, ?, ?, ?)`
      ).run(input.newFanId, input.displayName, email, input.now);
      const fan = db.prepare(`SELECT * FROM fans WHERE id = ?`).get(input.newFanId) as FanRow;

      const session = createSession(fan.id, input.newSessionToken, input.now, input.sessionExpiresAt);
      return { fan, session };
    });

    return tx();
  },
};

// Shared by both finalize paths. The WHERE clause repeats consumed_at IS
// NULL / expires_at > now (already checked by checkCode) so the UPDATE
// itself is the atomic guard against a race, not just the earlier read.
function consumeCode(email: string, code: string, now: string): boolean {
  const result = db
    .prepare(
      `UPDATE login_codes SET consumed_at = ?
       WHERE email = ? AND code = ? AND consumed_at IS NULL AND expires_at > ?`
    )
    .run(now, email, code, now);
  return result.changes > 0;
}

function createSession(fanId: string, token: string, createdAt: string, expiresAt: string): SessionRow {
  db.prepare(
    `INSERT INTO sessions (token, fan_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(token, fanId, createdAt, expiresAt);
  return db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token) as SessionRow;
}

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

  // Joined view for the collection screen / API - a fan's cards with their
  // template content, not just the bare ownership row. acquired_at is
  // card_instances.updated_at rather than created_at: for a redeemed card
  // they're the same, but for a traded card updated_at is when *this* fan
  // took ownership, which is what "when did I get this" actually means.
  listByOwnerWithTemplate(fanId: string): OwnedCardView[] {
    return db
      .prepare(
        `SELECT
           ci.id AS instance_id,
           ci.template_id AS template_id,
           ct.type AS type,
           ct.title AS title,
           ct.description AS description,
           ct.image_path AS image_path,
           ct.player_name AS player_name,
           ci.acquired_via AS acquired_via,
           ci.updated_at AS acquired_at
         FROM card_instances ci
         JOIN card_templates ct ON ct.id = ci.template_id
         WHERE ci.owner_fan_id = ?
         ORDER BY ci.updated_at DESC`
      )
      .all(fanId) as OwnedCardView[];
  },
};

export interface OwnedCardView {
  instance_id: string;
  template_id: string;
  type: CardTemplateRow["type"];
  title: string;
  description: string;
  image_path: string | null;
  player_name: string | null;
  acquired_via: "redemption" | "trade";
  acquired_at: string;
}

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

  // True if this card instance is already committed to some other pending
  // trade. Checked before creating a new proposal (so a fan can't offer, or
  // have requested from them, the same card in two trades at once) and used
  // to filter which cards show up as pickable in the propose flow.
  isCardInPendingTrade(cardInstanceId: string): boolean {
    const row = db
      .prepare(
        `SELECT 1 FROM trade_items ti
         JOIN trades t ON t.id = ti.trade_id
         WHERE t.status = 'pending' AND ti.card_instance_id = ?
         LIMIT 1`
      )
      .get(cardInstanceId);
    return row !== undefined;
  },

  // Every card instance this fan currently has tied up in a pending trade
  // (on either side of it - from_fan_id is always the current owner while a
  // trade is pending, ownership only moves on confirm). Used to filter a
  // fan's own collection down to what's actually offerable right now.
  pendingCardInstanceIds(fanId: string): Set<string> {
    const rows = db
      .prepare(
        `SELECT ti.card_instance_id FROM trade_items ti
         JOIN trades t ON t.id = ti.trade_id
         WHERE t.status = 'pending' AND ti.from_fan_id = ?`
      )
      .all(fanId) as { card_instance_id: string }[];
    return new Set(rows.map((r) => r.card_instance_id));
  },

  // Every trade this fan is party to (either side, any status), newest
  // first, with the counterpart's name and both sides' card content resolved
  // - what the UI actually needs to render a trade list without N+1 lookups
  // from the caller.
  listForFan(fanId: string): TradeView[] {
    const trades = db
      .prepare(
        `SELECT * FROM trades WHERE fan_a_id = ? OR fan_b_id = ? ORDER BY created_at DESC`
      )
      .all(fanId, fanId) as TradeRow[];
    if (trades.length === 0) return [];

    const tradeIds = trades.map((t) => t.id);
    const placeholders = tradeIds.map(() => "?").join(",");
    const items = db
      .prepare(
        `SELECT ti.trade_id, ti.card_instance_id, ti.from_fan_id, ti.to_fan_id,
                ct.title, ct.type
         FROM trade_items ti
         JOIN card_instances ci ON ci.id = ti.card_instance_id
         JOIN card_templates ct ON ct.id = ci.template_id
         WHERE ti.trade_id IN (${placeholders})`
      )
      .all(...tradeIds) as {
      trade_id: string;
      card_instance_id: string;
      from_fan_id: string;
      to_fan_id: string;
      title: string;
      type: CardTemplateRow["type"];
    }[];

    return trades.map((trade) => {
      const isProposer = trade.fan_a_id === fanId;
      const counterpartId = isProposer ? trade.fan_b_id : trade.fan_a_id;
      const counterpart = fansRepo.getById(counterpartId);
      const tradeItems = items.filter((i) => i.trade_id === trade.id);

      return {
        id: trade.id,
        status: trade.status,
        direction: isProposer ? "outgoing" : "incoming",
        counterpartFanId: counterpartId,
        counterpartName: counterpart?.display_name ?? "Unknown fan",
        offeredByMe: tradeItems
          .filter((i) => i.from_fan_id === fanId)
          .map((i) => ({ instanceId: i.card_instance_id, title: i.title, type: i.type })),
        offeredByThem: tradeItems
          .filter((i) => i.from_fan_id === counterpartId)
          .map((i) => ({ instanceId: i.card_instance_id, title: i.title, type: i.type })),
        createdAt: trade.created_at,
        confirmedAt: trade.confirmed_at,
      };
    });
  },
};

export interface TradeView {
  id: string;
  status: TradeRow["status"];
  direction: "outgoing" | "incoming";
  counterpartFanId: string;
  counterpartName: string;
  offeredByMe: { instanceId: string; title: string; type: CardTemplateRow["type"] }[];
  offeredByThem: { instanceId: string; title: string; type: CardTemplateRow["type"] }[];
  createdAt: string;
  confirmedAt: string | null;
}

// Convenience for callers that need a fresh id/timestamp without importing
// crypto directly (mirrors how apps/inkwell's API routes generate these).
export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
