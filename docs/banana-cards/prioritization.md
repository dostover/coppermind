# Banana Cards — Prioritization (draft)

> Copy of `claude/prioritization.md` from the Banana Cards Claude project,
> as of 2026-10-22.

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
| Pass It On cards | Medium | **High** | Low | High | Done |
| No-install first trade | Medium | **High** | Low | High | Done |
| Set completion and progress | **High** | Low | Low | **High** | Done (2026-10-22) |
| Access perks (cards unlock small real things) | **High** | Medium | Low | **High** | Done (2026-10-22) |
| Player/team social drops | Medium | **High** | Medium | High | **Next** |
| Broadcast cards for fans who can't get tickets | Medium | **High** | Low (once social drops exist) | Medium | **Next** |
| Families and kids (family collection) | **High** | Medium | High | Medium | Later |
| Card drops as bits / same-night moment cards | **High** | Medium | Medium (demo), High (operations) | High | Later |
| Fans in the cards (fan moment, crowd cards) | **High** | Medium | Medium (demo), High (consent) | High | Later |
| Trade ambassadors (players trading on the concourse) | Medium | Medium | None (operations only) | Low | Later |
| "A fan's night" rules (phone rule, claim window) | High | Low | Low | Low | Ongoing: applied as constraints to everything above |

## Now: set completion and access perks (built 2026-10-22)

Both are now in the demo: six sets on the collection page with progress and a
missing-card checklist, a perk unlocked by each finished set, per-card perks on
a few cards, set progress after redeeming, and a "finishes your set" hint when
trading. That makes player/team social drops the next item.

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

## Next: player/team social drops, then broadcast cards

Social drops are the business case made concrete: players and teams handing
out their own cards on their own channels, because growing their audience is
part of their pay. They rank just behind sets and perks because they need a
new mechanic (a shareable drop link with its own labeled card type), while
sets and perks only reuse what exists.

Broadcast cards come right after, because they're the same mechanic with a
different source: a code shown on a stream instead of a social post. Building
social drops first makes broadcast nearly free, and together they give fans
who can't get tickets a real way in.

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
- If social drops turn out to be the strongest part of the story with
  readers or stakeholders, they move to Now, since they carry the business
  case.
- If families prove to be the largest share of attendees, the family
  collection moves up despite its effort.
