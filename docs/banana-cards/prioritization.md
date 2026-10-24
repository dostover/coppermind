# Banana Cards — Prioritization (draft)

> Copy of `claude/prioritization.md` from the Banana Cards Claude project,
> as of 2026-10-24.

What to build next, in what order, and why. The candidates are the approved
Fan First areas in `card-value-model.md`, the two value ideas the demo doesn't
show yet (set completion and access), and the player/team social drops from
`product-brief.md`.

## How items are scored

Each item gets High / Medium / Low on four questions:

- **Fan experience:** does it make a fan's night, or the time between nights,
  better? (Banana Ball's north star.)
- **Fan base growth:** does it bring in new fans or reach? (The business case.)
- **Effort:** how much it takes to build *in the demo*. Real-world operations
  are noted separately, since the demo is the near-term deliverable.
- **Shows the idea:** how much it makes the core thesis visible to someone
  watching the demo. For a thought experiment whose job is to communicate the
  idea, this matters as much as effort.

Ties go to the item that teaches us more, or that later items depend on.

## Scores

| Item | Fan experience | Fan base growth | Demo effort | Shows the idea | Call |
|---|---|---|---|---|---|
| **Getting the card:** scan the token with a phone camera, tap to reveal, card art in the app | **High** | Medium | Low | **High** | Done (2026-10-22) |
| Pass It On cards | Medium | **High** | Low | High | Done |
| No-install first trade | Medium | **High** | Low | High | Done |
| Set completion and progress | **High** | Low | Low | **High** | Done (2026-10-22) |
| Access perks (cards unlock small real things) | **High** | Medium | Low | **High** | Done (2026-10-22) |
| Live stream cards (claimable only while the game is live) | **High** | **High** | Medium | High | Done (2026-10-24) |
| Player/team social drops | Medium | **High** | Low (once stream drops exist) | High | Done (2026-10-24) |
| Families and kids (family collection) | **High** | Medium | High | Medium | Later |
| Card drops as bits / same-night moment cards | **High** | Medium | Medium (demo), High (operations) | High | Later |
| Fans in the cards (fan moment, crowd cards) | **High** | Medium | Medium (demo), High (consent) | High | Later |
| Trade ambassadors (players trading on the concourse) | Medium | Medium | None (operations only) | Low | Later |
| "A fan's night" rules (phone rule, claim window) | High | Low | Low | Low | Ongoing: applied as constraints to everything above |

## Restated priority (2026-10-22): getting the card comes first

The first version of this list optimized the *second* experience. Trading got
most of the design attention, because the value model called it the
highest-stakes surface. But that was about risk (sliding into a marketplace),
not about what fans spend their night doing.

**Getting the card is the main experience.** Every fan does it first, it's
where presence value ("you had to be there") is created, and plenty of fans
will collect without ever trading. Trading still matters — it carries the
social value and the growth loops — but it depends on fans already having
cards they care about.

Meanwhile the demo's way of getting a card was the weakest part of it: type a
code into a box, read "You got a card!" in plain text. So it moves to the top:

- **Scan, don't type.** The token's QR code is a link, so a phone's own camera
  app opens the card directly. No app to install, no code to type; someone
  without an account joins with just a name, the same way trade links work.
- **A reveal moment.** The fan taps to flip the card and see what they got,
  with its art, then their progress in any set it belongs to. It takes
  seconds, so it fits before first pitch or between innings and stays out of
  the show itself.
- **Card art everywhere.** The illustrations made for the print sheet appear
  on cards in the collection, in trades and in the reveal.

Live stream cards and social drops are other ways of *getting* a card, so they
reuse this scan-and-reveal flow instead of building their own.

**Built 2026-10-22.** Token QR codes open `/redeem?code=…`; a new fan joins
with a name; the card waits face down until the tap, then flips to show its
art, story, stats and perk, followed by set progress and the first-card Pass It
On bonus. All 31 cards carry their illustrations across the app, and a
dev-only demo token sheet (`/tokens`) stands in for physical tokens.

## Now: set completion and access perks (built 2026-10-22)

Both are now in the demo: six sets on the collection page with progress and a
missing-card checklist, a perk unlocked by each finished set, per-card perks on
a few cards, set progress after redeeming, and a "finishes your set" hint when
trading.

The value model names five sources of value. The demo shows three (presence,
character and story, trading). These two complete it, and they're the answer
to the "between tours" problem: most fans see a team about once a year, and
sets and perks are what make the collection worth opening in between.

- **Cheap to build.** Both reuse cards that already exist: sets group them,
  and perks attach to them. No new mechanics for redemption or trading.
- **They strengthen trading.** A set with one missing card tells a fan exactly
  what to ask a friend for, which is the in-person loop the product is built on.
- **Risk to manage:** "collect them all" can tip into compulsion. The
  guardrails hold: sets never expire, there are no timers, missing cards are
  reachable by trading (never by paying), and rewards are small.

## Built: live stream cards, then player/team social drops (2026-10-24)

Both are ways of *getting* a card beyond the ballpark, so they share one
mechanism, a **drop**: a link (the QR on a stream's overlay, or a social post)
that opens the same face-down card and reveal as a token at the gate.

**Live streams came first** (changed 2026-10-24; the earlier draft had social
first). Streams are the most direct way to extend presence value to fans who
can't get tickets: "you were watching, live" is the online version of "you were
there," and it only works because a stream card can be claimed only while the
game is live.

**Social drops second.** They carry the business case: players and teams
handing out their own cards on their own channels, because audience growth is
part of their pay. Built on the same drop mechanism, they cost little extra.

What's in the demo: two stream drops (one live, one ended) and two social drops
(a player's and a team's), each card labeled with where it came from; two new
sets ("Watched Live", "Following Along"); and a drop console standing in for
the stream producer's go-live control and a player's post.

## Next

The drop mechanism opens a cheap path into the Later list: **card drops as
bits** ("everyone in section 104 just earned the Dancing Ump card") are a drop
announced from the field instead of a stream or a post. The demo could show
one without solving the ballpark operations behind it.

## Later, and why

- **Families and kids:** high value for a core audience, but it needs a new
  account model (a parent account with kid profiles) and care with children's
  data. It's the biggest build here; worth a design pass before code.
- **Card drops as bits, same-night cards, fans in the cards:** these make the
  cards part of the show, and they're some of the best ideas in the model. But
  their real cost is at the ballpark (staff, a same-night content pipeline,
  consent from featured fans), and those sit in the deliberately deferred
  operations work. The demo could fake one later as an illustration.
- **Trade ambassadors:** purely a staffing decision; nothing to build.

## What would change this order

- If the goal shifts from "demonstrate the idea" to "prepare a pilot," real
  operations effort dominates, and the order of the Later items changes.
- If families prove to be the largest share of attendees, the family
  collection moves up despite its effort.
