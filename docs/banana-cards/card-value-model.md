# Banana Cards — Value Model Framework

> Copy of `claude/card-value-model.md` from the Banana Cards Claude project,
> as of 2026-10-22.

**North star:** every card should make a fan's night better or bring a new fan
in. Anything that does neither doesn't ship. (Added 2026-10-20 to make the two
Banana Ball pillars — Fans First and fan base building — the explicit test for
every decision below.)

## Source philosophy (thesavannahbananas.com/about_us)
- Core mantra: "We are Fans First and We Entertain Always."
- "We are not your typical baseball team. We take chances. We bend the rules."
- Brand runs on characters and moments (Jesse Cole's yellow tuxedo, dancing umpire,
  breakdancing first-base coach, "Banana Baby" honored each game) more than
  athletic stats.
- Nonprofit arm: Bananas Foster, "Bringing Families Together" (foster care support).
- Business model: Fans First Entertainment, now 6 independent teams in the
  Banana Ball Championship League.

## The core inversion
Traditional cards: value = scarcity (print run size) + resale price + "will this
appreciate." Banana Cards: value = what you experienced to get it + who you shared
it with. Scarcity can still exist but is trivia, not the headline.

## Value dimensions (replacing scarcity as primary driver)
1. **Presence value** — tied to a specific game/stunt/bit you were physically there
   for. Modeled on Disney park-exclusive pins: value is "you had to be there," not
   "only 500 made."
2. **Character/story value** — built around bits and personalities (the tux, the
   dancing umpire, Banana Baby) rather than player stats.
3. **Trading value** — some cards exist only to be traded, never bought or earned
   solo (Disney lanyard-trading model). Value is in the social ritual of the trade,
   not resale price. This is what keeps trading "social, not financial."
4. **Completion/set value** — themed sets tied to a season, road-trip stop, or promo
   night; payoff is finishing the story, not owning the rarest single piece.
5. **Access value** — a card unlocks something small and real (shoutout, digital
   extra, portal badge, photo-op access) rather than being valuable because it's
   rare.

## Monetization stance
Breakeven, not ROI-driven. Base cards ideally bundled into the existing game-day/
ticket economy (part of the show, like the Banana Baby announcement). Specialty
packs or physical collectibles may carry a small cost to cover print/platform only
— never marketed or priced as an investment.

## Physical vs digital vs hybrid

**Physical.** Wins on the thing that made Disney pin trading actually work: a
tactile, in-person exchange between two strangers, requiring zero technology from
the fan, producing a real keepsake (displayable, signable, handable-down). Directly
reinforces presence value. Costs: real print/distribution cost cuts against
breakeven pricing; excludes remote/broadcast fans entirely, breaking the
"base cards open to everyone" assumption; adds physical inventory/logistics
(print runs, restocking, damage, loss).

**Digital.** Matches the project brief directly. No marginal unit cost (easy
breakeven or better); natural fit for the portal (collection tracking, sets,
completion, trade history); can carry real access-value unlocks; reaches every fan,
not just those in the building. Costs: digital trade UIs default to a
marketplace look/feel (buy/sell/offer), which fights the social-not-financial goal
unless deliberately designed against; real reputational risk of reading as an
NFT/crypto cash-grab even when that's not the intent; pulls fan attention to a
screen during a live show built around watching the bit in front of them, not
phones — cutting against "entertain in the actual game."

## Refinement: physical token (QR/redemption code) instead of a physical "card"

Instead of the physical object being a bespoke printed trading card (per-player art,
premium printing), it's a simple, cheap token — QR sticker, ticket-stub insert,
wristband, pin — whose only job is proving presence and linking to a digital card.
This changes the cost math: the real collectible (art, animation, stats,
unlockables) lives entirely on the digital side where it's cheap to make rich,
while the physical side doesn't need per-card art or premium print runs.

## DECISION: single-use redemption token

Settled: the physical touch is redemption-only. Scan once at the game, claim the
digital card, done — no reusable/transferable physical object, no NFC hardware, no
QR claim-transfer/anti-fraud engineering. Physical distribution can pair with a
separate non-physical code channel for remote/broadcast fans (stream overlay code,
website drop) without reprinting anything.

**Stakeholder take (recommended, with one non-negotiable condition):** this is the
right call for the breakeven mandate — physical cost drops to a cheap token instead
of a full card product across six teams, and it still does physical's one essential
job (proving presence) via the redemption moment itself.

The condition: this decision moves 100% of the weight of "trading value" and
"social, not financial" onto the digital trade UX — it is now the single
highest-stakes design surface in the product. Two requirements that follow from
that, both treated as hard constraints, not nice-to-haves:

1. **No marketplace grammar anywhere** in the trade flow — no visible rarity counts
   next to a trade, no "value," no browsable global inventory of tradeable cards
   from strangers. That silhouette is what every scarcity-driven card app already
   looks like; if the UI reads like a shop, the "not scarcity-driven" premise dies
   in the UI regardless of what's true underneath.
2. **Rebuild the presence requirement inside the digital trade.** Trades should
   require two fans to be physically together — see the trade mechanism decision
   below.

Softer recommendation: since there's no keepsake left after redemption, design the
physical token itself to feel like a small souvenir (not a receipt), so the
physical touch doesn't read as disposable even though it's functionally spent.

Reputational flag (restated): a fully digital collectible, redeemed once and traded
only through an app, is exactly the shape of product people associate with
NFT/crypto sports-collectible platforms. Positioning should address this head-on
("no blockchain, no resale, no dollar value, ever") rather than leave fans to
assume it.

## DECISION: presence check for redemption (v1)

**v1:** staff/kiosk-distributed codes only. The code is only ever handed out in
person by staff or a physical kiosk at the venue — the code itself is the presence
proof, no extra tech, no permissions prompts. Simplest to build, matches "start
simple, add sophistication later."

**Future option (deliberately deferred, not discarded):** geolocation-verified
redemption, for a case where codes need to be distributable ahead of time (e.g.
mailed, printed at home) but still need a presence check at claim time. Keep the
redemption data model open to adding a verification step later rather than
hardcoding "no check needed" assumptions.

## DECISION: ownership model

Strictly single-owner. Every card belongs to exactly one fan's collection at a
time and moves via trade. No shared/collective ownership for v1 — simpler data
model, and it's what trading actually requires (you can't meaningfully trade
something everyone already has).

## DECISION: trade mechanism (v1)

**Mutual QR scan.** Both fans open the portal, one shows a QR, the other scans it
with their phone camera, both confirm, trade executes. No Bluetooth/NFC hardware,
works on any phone, and reuses the same interaction pattern as redemption so fans
only learn one gesture across the whole product. This satisfies the "must be
physically together" requirement from the redemption-token decision above.

Note: the requirement is that the two fans are together, **not** that they are at
the ballpark. A trade works anywhere two fans meet — a school lunch table, a watch
party, a living room. (This matters for fans who can't get tickets; see below.)

**Future option (deferred):** tap-to-trade (NFC) or geofence-based trading, as a
slicker version of the same underlying "you must both be here, now" requirement.

---

## DECISION: Fan First and fan base building (approved 2026-10-22)

Status: **approved as the product's direction.** All eight areas below are
committed, and the guardrails in section 8 are hard constraints on every future
decision, alongside "no marketplace grammar." The first two growth loops in
section 4 (Pass It On cards and the no-install first trade) are built into the
demo; the rest still need to be prioritized, sized and built. The open
questions at the end are about *how*, not *whether*.

Why this section exists: the decisions above are strong at *protecting* fans
(no scarcity, no resale, no marketplace, honest about NFT risk) but were thin
on *delighting* fans and *growing* the fan base — the two things Banana Ball
actually leads with. Each subsection closes a specific gap.

### 1. A fan's night with Banana Cards
The decisions above describe mechanisms; this is what a fan actually lives through.

- **At the gate:** a player, character or staffer hands over the token as part of a
  bit — a moment, not a receipt.
- **Before first pitch / between innings:** scan, short card reveal, phone back in
  the pocket. Under a minute.
- **During the show:** the app asks for nothing. If a card drop is announced from
  the field ("everyone in section 104 just earned the Dancing Ump card"), it's
  claimed later, not right then.
- **Postgame / concourse:** trading with the people you sat next to.
- **The next day and after:** the card is still there, the set shows progress, and
  any access perk is redeemable.

### 2. Cards as part of the show ("Entertain Always")
Today the cards sit *next to* the entertainment. They should be *part of* it.

- **Card drops as bits:** announced from the field, handed out by players in the
  stands, tied to a stunt that just happened.
- **Same-night moment cards:** because cards are digital, a card for tonight's
  wildest play can exist before fans leave the parking lot.
- **Phone rule (hard constraint):** the app never needs attention during a bit.
  Codes stay claimable for a generous window after the game (exact length TBD), and
  there are no push notifications during a game.

### 3. Fans in the cards
The Bananas put fans in the show; the cards should too.

- **Fan moment cards:** the night's Banana Baby, the fan whose foul-ball catch
  recorded an out, the dance-off winner. The featured fan gets the original, and
  fans who were there can collect it.
- **Crowd cards:** cards for a section, a row, or the whole crowd at a tour stop
  ("I was in the stands in Fargo").
- **Requires consent:** a fan only appears on a card with their (or a parent's)
  explicit OK.

### 4. Growth loops (fan base building)
Trading is the built-in way one fan brings in another — design for it on purpose.

- **First trade needs no install (BUILT in demo):** a fan's trade QR is a link
  any phone camera can open. Someone without an account types just a name (no
  email, no download), gets a "Welcome to Banana Ball" card, and lands in a
  trade with that fan; the fan confirms as usual.
- **Pass-it-on cards (BUILT in demo):** each fan's first redemption includes one
  extra card meant to be *given* to someone new. It can't be kept or traded. The
  giver shows a one-time QR (good for 15 minutes, so they have to be together);
  the new person scans, types a name, and the card becomes theirs, marked as a
  gift from that fan. Only someone who hasn't redeemed a code yet can receive
  one, so it always brings in a new fan. This solves the cold-start problem:
  every new fan arrives holding a reason to recruit another.
- **Trade ambassadors:** players and characters available to trade on the
  concourse, so a fan whose friends aren't on the app yet still has someone to
  trade with — and a story to tell about it.

### 5. Fans who can't get tickets
Banana Ball tickets are very hard to get. If the best cards required attendance,
the system would reward the lucky few and leave most of the fan base on the outside
— the opposite of Fans First.

- **Broadcast channel as a real path, not a consolation prize:** codes during
  streams and broadcasts give their own clearly labeled broadcast cards and sets.
  Attendance cards still mean "you were there"; broadcast cards mean "you were
  watching" — both are honest, neither is "lesser."
- **Remote fans can trade:** since trades require fans to be together, not at the
  venue, remote fans trade with each other at watch parties, school, home.
- **Tour sets reward following the tour,** not only attending a stop.

### 6. Families and kids
Families are a core Banana Ball audience, and the brand's nonprofit is literally
"Bringing Families Together." The current design (personal phone, email sign-in)
doesn't fit a 9-year-old.

- **Family collection:** one parent account with kid profiles under it. Scanning
  and trading happen on the parent's phone; the kid picks the cards.
- **No email or personal data collected from kids.** US law (COPPA) restricts
  collecting data from children under 13, so the parent account is the only one
  with sign-in details.
- **Bananas Foster tie-in (idea):** a "Bringing Families Together" set, or a share
  of any specialty-pack proceeds going to the foundation.

### 7. Between tours
Most fans see a team about once a year. The collection should stay alive in
between — without manufacturing compulsion.

- Set progress, tour-stop recaps ("your season so far"), and access perks
  redeemable later.
- **No streaks, daily-login rewards or countdown pressure** (see guardrails).

### 8. Fan-first guardrails (hard constraints)
Alongside "no marketplace grammar":

- **No manipulative design:** no streaks, daily-login rewards, fake urgency or
  "only 2 left!" pressure.
- **No paid randomness:** if a specialty pack ever costs money, fans see exactly
  what's in it before buying. Paying for a random pull is gambling-shaped and off
  the table.
- **Nobody misses the show without a phone:** cards add to the night; they are
  never required to enjoy the game.
- **Collect the minimum fan data needed,** and never sell or share it.

### Open questions (to resolve while building)
- Consent process for fan moment cards (who asks, when, how a parent OKs it)
- How long codes stay claimable after a game
- Whether broadcast codes are allowed under the teams' streaming/broadcast deals
- Pass It On: should a fan earn more than one over time (e.g. one per season),
  or is one per fan the right amount?
- Quick join: how a name-only fan later adds an email to keep their cards (see
  technical-decisions.md, "Before real fans")

---

## Scoping status: sufficient to begin building

Value model, physical/digital shape, redemption mechanism, ownership model, and
trade mechanism are all settled enough to start on a data model and MVP (now
built as a demo in `apps/banana-cards`, including the two section 4 growth
loops). Remaining items are safe to resolve in parallel with building, not
blockers:
- Prioritize and sequence the approved Fan First work (sections 1–7)
- Concrete card taxonomy content: roster / moment / character / trade-only /
  milestone (the schema can support these types generically before every card's
  actual content is authored)
- Physical token form factor (sticker vs. wristband vs. pin) and distribution
  logistics (bundled with ticket vs. staff-handed vs. kiosk)
- Positioning/messaging plan to preempt the NFT/crypto association
- Monetization specifics for any specialty packs (pricing, breakeven target)

## Next steps under consideration
- Prioritize the approved Fan First work and pick what the next demo phase shows
- Concrete card taxonomy content (including fan moment and crowd cards)
- Physical token form factor + distribution plan
- Positioning/messaging plan
