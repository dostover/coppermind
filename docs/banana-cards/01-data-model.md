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
A fan's account. Minimal for now — no auth system is being designed yet, this is
just the identity that owns cards and participates in trades.

| column | type | notes |
|---|---|---|
| id | TEXT (uuid) | primary key |
| display_name | TEXT | shown on cards traded to others |
| created_at | TEXT (ISO) | |

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

## What's deliberately not here yet

- No pricing/value fields anywhere — intentional, per the "no marketplace
  grammar" constraint.
- No auth/session model — fans exist as a bare identity table until that's
  designed.
- No collective/shared-card table — ownership decision was strictly
  single-owner (see `card-value-model.md`).
- No geolocation verification implementation — `verification_method` is a
  reserved column, not a built feature.
