# Banana Cards — Value Model Framework

> Copy of `claude/card-value-model.md` from the Banana Cards Claude project,
> as of 2026-10-28.

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

**Principle (2026-10-28): scarcity is never the measure; we don't police the
market.** Anything that can be traded can be priced somewhere else, and codes
will sometimes leave the game they were meant for. We accept both. The goal
isn't to stop a third-party market from forming; it's that the product never
creates or rewards scarcity. If cards start selling for real prices, treat it
as a signal that scarcity crept into the design (an uneven pool, a card too
hard to get), and fix the design, not the fans.

## Value dimensions (replacing scarcity as primary driver)
1. **Presence value** — tied to a specific game/stunt/bit you were physically there
   for. Modeled on Disney park-exclusive pins: value is "you had to be there," not
   "only 500 made." Lives in **moment cards**, which can't be traded, so presence
   stays with the fan who was there (see "DECISION: pool cards and moment cards").
2. **Character/story value** — built around bits and personalities (the tux, the
   dancing umpire, Banana Baby) rather than player stats.
3. **Trading value** — some cards exist only to be traded, never bought or earned
   solo (Disney lanyard-trading model). Value is in the social ritual of the trade,
   not resale price. This is what keeps trading "social, not financial." Lives in
   **pool cards**.
4. **Completion/set value** — themed sets tied to a season, road-trip stop, or promo
   night; payoff is finishing the story, not owning the rarest single piece.
   (Built in the demo, 2026-10-22: six sets with progress and a missing-card
   checklist.)
5. **Access value** — a card unlocks something small and real (shoutout, digital
   extra, portal badge, photo-op access) rather than being valuable because it's
   rare. (Built in the demo, 2026-10-22: each set unlocks a perk when finished,
   and some single cards carry their own.)

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
"social, not financial" onto the digital trade UX — it is now the product's
biggest *risk*: the place it could slide into looking like a marketplace. (It is
not the core *experience*. That's getting the card — scanning a token at the
game and seeing what you got — which every fan does first and many fans may do
without ever trading. See "Restated priority" in `prioritization.md`,
2026-10-22.) Two requirements that follow from that risk, both treated as hard
constraints, not nice-to-haves:

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
rather than leave fans to assume it, without promising what we can't control
(see the scarcity principle above). Working line: "No blockchain. We never sell
cards for chances, and nothing in the app has a dollar value."

## DECISION: presence check for redemption (v1)

**v1:** codes are given out at the game, in whatever form fits — printed in the
game program, on a seat, with a concession receipt, handed over by a staffer, or
by a player as part of a bit. (The gate hand-off used in earlier drafts is one
example, not the mechanism.) The code itself is the presence proof: no extra
tech, no permissions prompts. Simplest to build, matches "start simple, add
sophistication later."

Codes that leave the game (a program taken home, an unscanned code given away)
are accepted, per the scarcity principle. A code given away is still a fan
bringing someone in.

**Future option (deliberately deferred, not discarded):** geolocation-verified
redemption, for a case where codes need to be distributable ahead of time (e.g.
mailed, printed at home) but still need a presence check at claim time. Keep the
redemption data model open to adding a verification step later rather than
hardcoding "no check needed" assumptions.

## DECISION: ownership model

Strictly single-owner. Every card belongs to exactly one fan's collection at a
time. Pool cards move via trade; moment cards stay with the fan who earned them
(see below). No shared/collective ownership for v1 — simpler data model, and
it's what trading actually requires (you can't meaningfully trade something
everyone already has). (A family sharing one account, per section 6, is still
one owner: the account.)

## DECISION: pool cards and moment cards (2026-10-28)

Every code is one of two kinds, and the kind decides whether the card it gives
can be traded. Either kind can come from any channel: at the game, on a live
stream, or in a player's or team's post.

| | Pool cards | Moment cards |
|---|---|---|
| From | A general code | A specific code |
| What you get | A random card from a pool; every card equally likely | One particular card |
| Tradeable | Yes | No: it stays with the fan who earned it |
| Where its value comes from | Trading, sets, characters and story | Presence: something you did or were there for |
| Example | A roster or stadium card from the team's season pool | Jesse's card, from the code in his hat, because you stuck around for his autograph |

**Why.** Presence only means something if it stays with the person who was
there; when presence cards could be traded, "you were there" ended up with
people who weren't (H1 in `product-brief.md`). Splitting the two keeps
presence where it belongs and leaves everything else free to trade. Moment
cards can be genuinely scarce (Jesse signs thirty hats), but since they never
move in the app, that scarcity never becomes trading value: scarce like a
signed ball, not like a chase card. Pass It On cards were already this kind of
special, stays-put card.

### Pools
- **The card is drawn when the code is scanned, not when it's printed.** A
  general code points to a pool, not a card. Nobody can flip through programs
  looking for a good one, every channel gives the same odds, and a print run
  only needs unique codes.
- **Equal odds, always.** No weights, no tiers, no "rare" labels, no shiny
  variants, and fans can see every card in a pool. The reveal's suspense comes
  from *which* card you get, never from how rare it is (H2). Equal supply won't
  mean equal desire — everyone may want the Dancing Ump — and that's the
  healthy kind of value: it gets fans asking each other.
- **Scope: per team per season, starting around 24 cards,** with a few
  tour-stop cards rotated in. Rough sizing with equal odds: a 20-card pool takes
  about 72 pulls to finish alone and a 30-card pool about 120, while a section
  of 50 fans each pulling once from 30 cards turns up about 24 different ones.
  So a pool this size is too big to finish alone and easy to finish by trading,
  which is the behavior we want. Pools that grow much larger make duplicates
  scarce, and trading runs on duplicates.
- **Built to scale.** A pool is made of series (below), so it can grow past the
  starting size without changing anything else, and a code can draw from a
  team's whole pool or from one series (a themed night, say).

### Two ways teams and players make cards
- **Organized series:** a planned run across many players in one style — for
  example, every player gets an anime-style card. Series go into pools, are
  tradeable, and form sets.
- **Self-designed moment cards:** a player or team designs a card for a moment
  and gives out specific codes for it — in a hat, after a bit on the stream, in
  a post. Not tradeable. Guardrail: neither the card nor how it's promoted ever
  says how few exist.

### Every channel can give both
- **At the game:** pool codes in programs, on seats, with receipts; moment codes
  from players, bits and fan moments (section 3).
- **Live streams:** a pool code on screen while the game is live, plus moment
  codes for things that happen on the stream. Streams are a substantial part of
  Banana Ball's fan base growth, so remote fans need both: cards to trade and
  keepsakes of their own.
- **Social drops:** the player or team chooses per drop.

### Sets and keepsakes
- **Sets contain pool cards only,** so every set can be finished by trading,
  including by fans who never get a ticket.
- **Moment cards live on a Keepsakes shelf** in the collection, with their own
  light groupings but no completion pressure.
- **Small extra, not core:** a "games I've been to" list on a fan's profile,
  filled in automatically from codes redeemed at games.

## DECISION: trade mechanism (v1)

**Mutual QR scan.** Both fans open the portal, one shows a QR, the other scans it
with their phone camera, both confirm, trade executes. No Bluetooth/NFC hardware,
works on any phone, and reuses the same interaction pattern as redemption so fans
only learn one gesture across the whole product. This satisfies the "must be
physically together" requirement from the redemption-token decision above.

Note: the requirement is that the two fans are together, **not** that they are at
the ballpark. A trade works anywhere two fans meet — a watch party, a backyard,
a living room. (This matters for fans who can't get tickets; see below.)

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

- **At the game:** a code arrives in the program, on the seat, or from a player,
  character or staffer as part of a bit — a moment, not a receipt.
- **Before first pitch / between innings:** scan, short card reveal, phone back in
  the pocket. Under a minute.
- **After the game:** a player signing autographs, or a character doing a bit,
  hands out moment codes for their own card.
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
  Tokens handed out in person stay claimable for a generous window after the game
  (exact length TBD), and there are no push notifications during a game. Live
  stream codes are the one exception (see section 5): they only work while the game
  is streaming live, because "you were watching live" is what that card means, and a
  fan already watching on a screen loses nothing to a ten-second scan.

### 3. Fans in the cards
The Bananas put fans in the show; the cards should too.

- **Fan moment cards:** the night's Banana Baby, the fan whose foul-ball catch
  recorded an out, the dance-off winner. The featured fan gets the original, and
  fans who were there can collect it. All are moment cards: not tradeable.
- **Crowd cards:** cards for a section, a row, or the whole crowd at a tour stop
  ("I was in the stands in Fargo").
- **Requires consent:** a fan only appears on a card with their (or a parent's)
  explicit OK. When the featured fan is under 13, the original goes into their
  family's (adult) account.

### 4. Growth loops (fan base building)
Trading is the built-in way one fan brings in another — design for it on purpose.
Every new account, from either loop, starts with the year-of-birth question in
section 6.

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
  every new fan arrives holding a reason to recruit another. If the person
  receiving it is under 13, a grown-up with them scans the same QR and the card
  joins that family's account.
- **Trade ambassadors:** players and characters available to trade on the
  concourse, so a fan whose friends aren't on the app yet still has someone to
  trade with — and a story to tell about it.

### 5. Beyond the ballpark: live streams and social drops (BUILT in demo, 2026-10-24)
Banana Ball tickets are very hard to get. If the best cards required attendance,
the system would reward the lucky few and leave most of the fan base on the outside
— the opposite of Fans First. So the Fan First experience extends past the gate,
first to games streamed online, then to players' and teams' own social channels.

There are three places to get a card, and each can give both pool cards and
moment cards (see "DECISION: pool cards and moment cards"). Every card is labeled
honestly with where it came from, and the label stays with it for good, even
after a pool card is traded:

| Where | How a fan gets it | What the card means | Label on the card |
|---|---|---|---|
| At the game | Scan a code from the game (program, seat, staffer, player) | "You were there" | (the card's own game and story) |
| Watching a live stream | Scan the QR on screen during the broadcast | "You were watching, live" | "Watched live on the Banana Ball stream" |
| Following a player or team | Open the drop they post on their own channel | "You were following" | "From Static's drop" |

None of these is a consolation prize. Pool codes from streams and drops draw from
the same tradeable pools as codes at the game, so every set can be finished by a
fan who never gets a ticket, and stream and drop moment cards give remote fans
keepsakes of their own. (Changed 2026-10-28: the demo's "Watched Live" and
"Following Along" sets were built from drop cards; under the pool/moment split,
sets hold pool cards only, so those two need redefining.)

- **Live streams come first, and they're live only.** A stream card can only be
  claimed while the game is actually streaming. When the stream ends, its code stops
  working. "You were watching live" is the online version of "you had to be there,"
  and real time is what keeps it meaningful. (Replays and on-demand viewing are out
  of scope for now.)
- **Player and team social drops.** A player or team posts a drop on their own
  channel; it stays open until a plain end date they set. Guardrails: no countdown
  timers, no "only 100 left," no follow-to-win or engagement-bait mechanics, never
  paid. It also serves the business case (see `product-brief.md`): audience growth is
  part of players' and teams' pay, so their channels become a way into Banana Ball.
- **One code per fan per drop.** A pool drop gives each fan one pull; more copies
  of a pool card only arrive by trading. A moment drop gives each fan its card
  once, and it stays with them.
- **Online gets fans in; in person keeps them.** Stream and social cards are easy to
  claim anywhere, but trading still happens face to face. Remote fans trade with each
  other at watch parties or at home (trades require fans to be together, not to be
  at the venue).
- **Tour sets reward following the tour,** not only attending a stop.

### 6. Families and kids — DECISION: accounts are 13+ (2026-10-28)
Families are a core Banana Ball audience, and the brand's nonprofit is literally
"Bringing Families Together." But building accounts for children means
verifiable parental consent and a separate kid-profile system — the hardest and
riskiest part of the product, and not something this stage needs to prove.

**Decision:** every account belongs to someone 13 or older. Kids take part
through a grown-up's account, which the family shares as its collection.

- **Neutral age question first.** Every new account (email sign-up, quick join
  from a trade or Pass It On QR, a new fan redeeming a token or drop) starts
  with "What year were you born?" — no pre-filled year, no hint about a minimum
  age, nothing collected before it's answered.
- **Under 13: hand it to a grown-up.** The app shows a friendly screen ("Ask a
  grown-up to scan this to keep your card"), creates no account and collects
  nothing, not even a name. The same QR still works when the grown-up scans it,
  so the card isn't lost.
- **A shared family collection.** One adult account is the family's collection.
  The kid holds the phone for the reveal and picks what to trade; the grown-up
  scans and confirms. This also means a parent is part of every trade a kid
  makes, so kids never trade with strangers on their own.
- **Adult-run in tone and marketing (hard constraint).** A 13+ rule only holds
  if the product doesn't look aimed at children. Copy is written to the
  grown-up; no kid-targeted drops; no "share with your classmates"; no school
  settings in growth or trading examples. Family-friendly, adult-run.
- **Deferred, not discarded:** kid profiles under a parent account (with
  verifiable parental consent), if families turn out to be a large share of
  users. Keep the data model open to adding profiles under an account later.
- **Bananas Foster tie-in (idea):** a "Bringing Families Together" set, or a share
  of any specialty-pack proceeds going to the foundation.

Why 13+ over kid profiles now: it removes parental-consent flows and children's
data from the build entirely, settles the stranger-trading question, and keeps
what families actually do together (the parent's phone, the kid choosing).
What it gives up: a kid's own "my collection," and the kid-to-kid growth loop —
which was the loop creating the legal problem. (See H8 in `product-brief.md`.
Not legal advice; a lawyer should review the age screen before launch.)

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
- **Accounts are 13+,** and the product stays adult-run in tone and marketing
  (section 6).

### Open questions (to resolve while building)
- Consent process for fan moment cards (who asks, when, how a parent OKs it)
- How long codes stay claimable after a game
- Whether stream codes are allowed under the teams' streaming/broadcast deals
- How players and teams create their own drops (accounts, approval, how many)
- Whether a drop should ever be made for replays or on-demand viewing
- Pass It On: should a fan earn more than one over time (e.g. one per season),
  or is one per fan the right amount?
- Quick join: how a name-only fan later adds an email to keep their cards (see
  technical-decisions.md, "Before real fans")
- Age question: whether to store the birth year or only an "over 13" flag
  (minimum data says the flag)
- Pool size: start around 24 per team per season and tune from real trade rates
- How trade-only cards (value dimension 3) fit the pool/moment split
- Card story: proposed to show the card's origin and how *you* got it, never
  the full chain of past owners or a trade count (which would turn provenance
  into pedigree)
- Tools for players and teams to design moment cards and create series
  (likeness approval, art, how many codes)

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
