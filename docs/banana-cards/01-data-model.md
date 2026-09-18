# Banana Cards — Data Model

This sketches the entities needed to support the decisions locked in
`claude/card-value-model.md` (see that doc in the Banana Cards project for the
full reasoning). Nothing here is final — it's the minimum shape needed to start
building against, matching the "sketch, then iterate in the build" plan.

## Design decisions this schema encodes

- **Redemption is single-use** (`redemption_codes`): a code redeems exactly one
  card instance, once, and is spent afterward.
- **Presence check for v1 is issuance-based, not verification-based**: a code
  only proves presence because it was only ever handed out in person (staff/
  kiosk). No geolocation field is required for v1, but `redemption_codes` leaves
  room to add a verification step later without a schema rewrite.
- **Ownership is strictly single-owner**: a `card_instance` has exactly one
  `owner_fan_id` at any time. No shared/collective ownership table.
- **Trades require presence** (`trades` / `trade_items`): a trade is a single
  atomic event between two fans, confirmed via mutual QR scan, not an async
  listing/offer system. There is deliberately no "cards available to trade"
  browsable table — that would reintroduce marketplace grammar the value model
  explicitly rejects.
- **Card content is separated from card ownership**: `card_templates` holds the
  art/story/type (what a card *is*), `card_instances` holds who owns *this one*.
  This is what lets the physical token stay cheap (it only carries a code) while
  the digital card content stays rich.

## Entities

### `fans`
A fan's account. `email` was added after the original table shipped (auth
wasn't designed yet) via a guarded `ALTER TABLE`, matching apps/inkwell's own
migration pattern for evolving an existing table.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| display_name | TEXT | chosen at registration; shown on cards traded to others |
| email | TEXT | unique (enforced via index, not a column constraint); how a fan logs back in |
| created_at | TEXT (ISO) | |

### `login_codes`
One-time codes emailed to verify an address (see
`claude/technical-decisions.md`'s email + one-time-code auth decision). Not
tied to a `fan_id` — the fan may not exist yet on first login. Deliberately
neutral on delivery format (a typed code and a clickable link both work
against this shape); v1 ships a typed numeric code.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| email | TEXT | normalized lowercase |
| code | TEXT | |
| expires_at | TEXT (ISO) | 10 minutes from issuance in v1 |
| consumed_at | TEXT (ISO) | nullable; set atomically on the finalize call, not on the read-only check |
| created_at | TEXT (ISO) | |

### `sessions`
A bearer session token the client stores and sends back
(`Authorization: Bearer <token>`), not a cookie-only session — see
`claude/technical-decisions.md`'s API-first decision. The web reference
client additionally mirrors the token into an httpOnly cookie purely for its
own convenience; the token itself is the canonical mechanism a future mobile
client would use directly.

| column | type | notes |
|---|---|---|
| token | TEXT | primary key |
| fan_id | TEXT (uuid) | FK → `fans.id` |
| created_at | TEXT (ISO) | |
| expires_at | TEXT (ISO) | 90 days from creation in v1 ("stay signed in") |
| revoked_at | TEXT (ISO) | nullable; set on sign-out |

### Two-phase login flow
`checkCode` is read-only — it tells the caller whether the code is valid and
whether this email belongs to an existing fan, without spending the code.
The client then calls one of two finalize operations, each of which
re-validates and *atomically consumes* the code (an `UPDATE ... WHERE
consumed_at IS NULL AND expires_at > ?` whose affected-row count is the
race guard, not just the earlier read):

- `completeSignIn` — existing fan, code consumed, session minted.
- `completeRegistration` — new fan, code consumed, fan row created with the
  chosen display name, session minted.

This two-step split (rather than one combined "verify and log in" call) is
what lets the client show a username-selection screen for new fans without
a separate "pending registration" table — the code just stays unconsumed
until whichever finalize call actually runs.

### `events`
A single game/promo night. Cards get tied to events for presence value
("you were there for *this*"), and redemption codes get issued per-event.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| team | TEXT | which Banana Ball team (league has multiple) |
| opponent | TEXT | nullable — some events aren't games (promo nights) |
| venue | TEXT | |
| event_date | TEXT (ISO date) | |
| status | TEXT | `upcoming` \| `live` \| `completed` |
| created_at | TEXT (ISO) | |

### `card_templates`
The *design* of a card — its content, not any specific fan's copy of it. One
template can back many redeemed instances (a roster card) or exactly one
(a truly unique moment card, enforced at the application level via how many
codes get issued against it, not by the schema).

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| type | TEXT | `roster` \| `moment` \| `character` \| `trade_only` \| `milestone` |
| title | TEXT | |
| description | TEXT | the story/bit, not stats |
| image_path | TEXT | |
| event_id | TEXT (uuid) | nullable FK → `events.id`; set for `moment` cards tied to a specific game, null for evergreen `roster`/`character` cards |
| player_name | TEXT | nullable — only meaningful for `roster` cards |
| created_at | TEXT (ISO) | |

`trade_only` templates are never attached to a redemption code directly issued
to a claimant as a "keep" — they're seeded into circulation via a small initial
distribution and from then on only move by trade. (Mechanism for that initial
seeding is a v1-build decision, not a schema one.)

### `redemption_codes`
One row per physical token issued. v1 issuance is staff/kiosk-distributed only,
so the code itself is the presence proof — see the deferred `verification_method`
column below for the future geolocation option.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| code | TEXT | unique, the string encoded in the QR |
| template_id | TEXT (uuid) | FK → `card_templates.id` — which card this code redeems |
| event_id | TEXT (uuid) | nullable FK → `events.id`, for audit/context |
| issued_via | TEXT | `staff` \| `kiosk` (v1 only has these two) |
| status | TEXT | `unredeemed` \| `redeemed` \| `void` |
| redeemed_by_fan_id | TEXT (uuid) | nullable FK → `fans.id`, set on redemption |
| redeemed_at | TEXT (ISO) | nullable |
| verification_method | TEXT | nullable, unused in v1 — reserved for `geolocation` when that's built |
| created_at | TEXT (ISO) | |

### `card_instances`
A specific fan's specific owned card. This is what moves in a trade.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| template_id | TEXT (uuid) | FK → `card_templates.id` |
| owner_fan_id | TEXT (uuid) | FK → `fans.id` — single owner, always exactly one |
| acquired_via | TEXT | `redemption` \| `trade` |
| redemption_code_id | TEXT (uuid) | nullable FK → `redemption_codes.id`, set if acquired via redemption |
| created_at | TEXT (ISO) | when this instance was first created (redeemed) |
| updated_at | TEXT (ISO) | bumped whenever `owner_fan_id` changes via trade |

### `trades`
One atomic trade event between two fans, confirmed via mutual QR scan (v1
mechanism — see `card-value-model.md`). No `pending offer` browsing state is
exposed to other fans; a trade only exists once both sides are present and
confirming together.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| fan_a_id | TEXT (uuid) | FK → `fans.id` |
| fan_b_id | TEXT (uuid) | FK → `fans.id` |
| status | TEXT | `pending` \| `confirmed` \| `cancelled` |
| method | TEXT | `qr_scan` (only value in v1; future: `tap`, `geofence`) |
| event_id | TEXT (uuid) | nullable FK → `events.id`, which game the trade happened at |
| created_at | TEXT (ISO) | |
| confirmed_at | TEXT (ISO) | nullable |

### `trade_items`
The card(s) each side contributed to a trade. Supports 1-for-1 swaps (the v1 UX
target) and multi-card trades without a schema change.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| trade_id | TEXT (uuid) | FK → `trades.id` |
| card_instance_id | TEXT (uuid) | FK → `card_instances.id` |
| from_fan_id | TEXT (uuid) | FK → `fans.id` |
| to_fan_id | TEXT (uuid) | FK → `fans.id` |

On a trade's `status` moving to `confirmed`, each `trade_items` row's
`card_instance` gets `owner_fan_id` updated to `to_fan_id`, `acquired_via` set to
`trade`, and `updated_at` bumped. This is done as a single transaction.

## Collection view

`cardInstancesRepo.listByOwnerWithTemplate(fanId)` joins `card_instances` to
`card_templates` for a fan's owned cards, ordered by `updated_at` (most
recently acquired first — for a traded card this is when *this* fan took
ownership, not when the instance was originally minted). This is the query
behind both the `/collection` page (server component, reads it directly) and
`GET /api/cards/mine` (its JSON twin for a future mobile client).

`/collection` renders that list through `CollectionBoard`, a client
component that filters (by card type and by acquired-via), sorts (newest/
oldest/title/type), and summarizes (total count, per-type counts,
redeemed-vs-traded counts) entirely over the already-fetched list — no new
query or API needed, since a fan's collection is small enough that doing
this server-side would just add round trips for no benefit.

The redemption flow itself is `POST /api/cards/redeem`: auth-required,
resolves a code via `redemptionCodesRepo.redeem()` (the atomic
redemption_codes + card_instances transaction described above), and returns
the newly-created card's template content. The `/redeem` page wraps this in
a form and gates on sign-in, prompting the fan to sign in first rather than
exposing the form at all when there's no session.

## Trading

The `/trade` page is the web reference client's take on the mutual-QR-scan
mechanism decided in `card-value-model.md`. Since both fans have to be
physically together anyway, the "scan" is a fan's own id, shown as text and
as a QR image (generated server-side with the `qrcode` package and handed to
the page as a data URL — no QR library needed in the browser bundle); a real
mobile client could later replace typing that code in with an actual camera
scan without any backend change, since both resolve to the same fan id.

- `GET /api/trades/lookup/[fanId]` — resolves one already-known fan id (from
  the code exchange above) into their display name and their trade-eligible
  cards (their collection minus anything already tied up in another pending
  trade). Deliberately not a searchable directory — you can only look up a
  fan whose id you already have, which is what keeps this from becoming a
  browsable "who has what" listing.
- `POST /api/trades` — the proposer offers one of their own cards and
  requests one of the other fan's (both already validated as owned and
  trade-eligible), creating a `pending` trade via `tradesRepo.create()` with
  both `trade_items` rows set. Nothing moves yet.
- `POST /api/trades/[id]/confirm` — only the recipient (`fan_b`) can call
  this. The proposer already committed to the terms by building them after
  seeing the recipient's collection in person; the recipient's confirm is the
  second of the two confirmations the mechanism requires, and the only thing
  that actually calls `tradesRepo.confirm()` (the atomic ownership swap).
- `POST /api/trades/[id]/cancel` — either side of a pending trade can back
  out (the proposer changing their mind, or the recipient declining instead
  of confirming). Confirmed trades don't unwind — see the single-atomic-event
  framing in `card-value-model.md`.
- `GET /api/trades` — the fan's own trades (pending incoming, pending
  outgoing, and history), as the API-first JSON twin of `/trade`'s server-
  rendered lists, via the new `tradesRepo.listForFan()`.

`tradesRepo.isCardInPendingTrade()` and `tradesRepo.pendingCardInstanceIds()`
back the "trade-eligible" filtering above — a card already offered or
requested in one pending trade can't be pulled into a second one until that
trade resolves.

## What's deliberately not here yet

- No pricing/value fields anywhere — intentional, per the "no marketplace
  grammar" constraint.
- No collective/shared-card table — ownership decision was strictly
  single-owner (see `card-value-model.md`).
- No geolocation verification implementation — `verification_method` is a
  reserved column, not a built feature.
- No real camera-based QR scanning — the web reference client uses typed/
  displayed codes; an actual scan is a mobile-client enhancement on top of
  the same `fanId`-based lookup, not a schema change.
