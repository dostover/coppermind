# Banana Cards — Product Brief

> Copy of `claude/product-brief.md` from the Banana Cards Claude project,
> as of 2026-10-24.

Why Banana Cards exists, who it's for, and how we'd know it's working. The
*how* lives in `card-value-model.md` (product decisions) and
`technical-decisions.md` (engineering).

## What this is

An independent product concept and thought experiment, built to show product
thinking end to end: from an opportunity, through value-model decisions and
tradeoffs, to a working demo. It isn't affiliated with the Savannah Bananas,
Fans First Entertainment or the Banana Ball Championship League.

## The opportunity

Banana Ball has turned most of baseball's conventions upside down to put fans
and the experience first: a two-hour game, fans catching foul balls for outs,
players dancing, the crowd as part of the show.

Trading cards are one of the few places it hasn't done that yet. Banana Ball
cards today are ordinary baseball cards with different stats: same format, same
value logic (scarcity, chase cards, resale), same relationship between fan and
card.

**The opportunity is to bring the Banana Ball ethos to trading cards.** That
means cards whose value comes from being there, from the characters and bits,
and from trading with another fan in person, rather than from rarity and resale.
It isn't a fix for a broken problem. It's a gap where the brand's philosophy
hasn't reached yet.

## Who it's for

| Group | What they want | What Banana Cards gives them |
|---|---|---|
| Fans at a game | A keepsake of a night they loved | A card tied to that game, and people to trade with on the concourse |
| Fans who can't get tickets | A way in, without being second-class | Their own clearly labeled cards from live streams and from players' and teams' social drops, with their own sets, and trading anywhere fans meet |
| Families and kids | Something to do together | A family collection; trading on a parent's phone |
| Brand-new fans | A low-effort first step | A Pass It On card from a friend; joining with just a name |
| Players and teams | A bigger following (it's part of their pay) | Their own cards to drop on their social channels |

## Business case: fan base growth

Banana Cards isn't meant to make money; specialty items are priced only to
break even (see `card-value-model.md`). Its return is **fan base growth**,
for Banana Ball as a whole and for each team and player.

The lever is that teams and players already have a reason to grow their
audience: their compensation includes bonuses tied to it. So Banana Cards
should let **individual players and teams create their own cards and drop
them on their social channels.** A player posts a drop, fans claim the card,
and the card pulls them into the app, into trading, and toward a game. Every
player becomes a distribution channel, and each one grows Banana Ball's reach
along with their own.

How social drops fit the value model:

- **Labeled honestly.** A card claimed from a social post means "you were
  following," the way a broadcast card means "you were watching." It never
  pretends to be a "you were there" card.
- **Online gets you in; in person keeps you.** A social drop is easy to claim
  anywhere, but trading still happens face to face. So the drop brings online
  followers into the in-person loop rather than replacing it.
- **Same guardrails.** No "only 100 left!" pressure, no follow-to-win
  contests that turn fans into engagement bait, and no paying for chances.

## How we'd know it's working

Banana Ball's north star is fan experience, so Banana Cards is judged by
whether it makes the experience better **and** grows the fan base. The exact
metrics are still to be picked. Candidates:

**Fan base growth**
- New fans per Pass It On card given
- Live stream and social drop claims that become active collectors (made a
  trade or redeemed at a game)
- Share of live stream viewers who claim the stream's card
- Follower growth on players' and teams' channels around drops
- First-time attendees who arrived already holding cards

**Fan experience**
- Share of fans at a game who redeem a card
- Share of collectors who trade at least once, and trades per game
- Collectors who come back between tours (checking sets, using perks)

**Guardrails (signals of harm)**
- App use during the show itself (should stay near zero)
- Any sign of off-platform resale of accounts or cards
- Complaints from families or first-timers

## Why there's no competitor analysis

Existing card products (licensed sports cards, digital collectibles, NFT
platforms) are built on rarity, chase cards and monetization: the exact model
Banana Cards rejects. They're useful as a description of what *not* to look
like (see the "no marketplace grammar" constraint in `card-value-model.md`),
but not as benchmarks. The comparison that matters is internal: Banana Ball
already did this to baseball; this does it to cards.

## Working assumptions

This is a thought experiment, so the product is built on stated assumptions
rather than validated research. The main ones:

- Fans value a card more for the story of getting it than for its rarity.
- Fans will trade in person if it's easy and social, without price as a motive.
- A card given by a friend is a stronger way in than an ad or an app-store link.
- Players and teams will use their own social channels to drop cards, because
  it serves their growth goals.
- The app can stay out of the way during the show itself.

## Deliberately out of scope for now

- **Game-day operations** (who hands out tokens, staff tools): later.
- **Trust and safety** (display-name moderation, account resale, kids' data):
  after the idea itself is validated.
- **Rollout plan** (pilot game to full tour): not needed for a thought
  experiment.
