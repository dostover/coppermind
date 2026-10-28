# Banana Cards — Product Brief

> Copy of `claude/product-brief.md` from the Banana Cards Claude project,
> as of 2026-10-28.

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
| Fans at a game | A keepsake of a night they loved | Cards from the game's codes to trade with the people around them, and moment cards for things only they did, which stay theirs |
| Fans who can't get tickets | A way in, without being second-class | Their own clearly labeled cards from live streams and from players' and teams' social drops, with their own sets, and trading anywhere fans meet |
| Families and kids | Something to do together | A shared family collection on a parent's account: the kid picks, the parent scans and trades. Accounts are 13+ (see H8) |
| Brand-new fans (13+) | A low-effort first step | A Pass It On card from a friend; joining with a year of birth and a name |
| Players and teams | A bigger following (it's part of their pay) | Their own cards to drop on their social channels |

## Business case: fan base growth

Banana Cards isn't meant to make money; specialty items are priced only to
break even (see `card-value-model.md`). Its return is **fan base growth**,
for Banana Ball as a whole and for each team and player.

The lever is that teams and players already have a reason to grow their
audience: their compensation includes bonuses tied to it. (Not yet sourced;
see assumption H10 below.) So Banana Cards should let **individual players and
teams create their own cards and drop them on their social channels.** A
player posts a drop, fans claim the card, and the card pulls them into the
app, into trading, and toward a game. Every player becomes a distribution
channel, and each one grows Banana Ball's reach along with their own.

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
- Real prices for cards or accounts off-platform. We don't police this (anything
  tradeable can be priced somewhere); it's a diagnostic that scarcity has crept
  into the design and something needs fixing
- Complaints from families or first-timers

Caution: while accounts cost only a name, growth counts can be inflated by one
person making several accounts (see H11).

## Why there's no competitor analysis

Existing card products (licensed sports cards, digital collectibles, NFT
platforms) are built on rarity, chase cards and monetization: the exact model
Banana Cards rejects. They're useful as a description of what *not* to look
like (see the "no marketplace grammar" constraint in `card-value-model.md`),
but not as benchmarks. The comparison that matters is internal: Banana Ball
already did this to baseball; this does it to cards.

## Working assumptions

This is a thought experiment, so the product is built on assumptions rather
than validated research. Each one has a status:

- **Accepted:** we know it's an assumption and are fine building on it for now.
- **Mitigated:** something in the design already reduces the risk.
- **Open:** needs a decision, a design change or a fact check.

### Stated from the start

| # | Assumption | Status |
|---|---|---|
| S1 | Fans value a card more for the story of getting it than for its rarity. | Accepted (core thesis) |
| S2 | Fans will trade in person if it's easy and social, without price as a motive. | Accepted (core thesis) |
| S3 | A card given by a friend is a stronger way in than an ad or an app-store link. | Accepted |
| S4 | Players and teams will use their own social channels to drop cards, because it serves their growth goals. | Accepted; depends on H10 |
| S5 | The app can stay out of the way during the show itself. | Mitigated: phone rule, no in-game notifications, claim window after the game |

### Surfaced on review (2026-10-28)

Assumptions built into earlier decisions without being named.

**Value model**

| # | Assumption | Status |
|---|---|---|
| H1 | Presence value survives trading. A traded card still says "you were there," but nothing records whether the person now holding it was. Sets that can be finished by trading reward collecting other people's presence. | Mitigated (2026-10-28): presence lives in moment cards, which can't be traded; tradeable pool cards carry story and trading value; sets hold pool cards only. See "DECISION: pool cards and moment cards" in `card-value-model.md` |
| H2 | The reveal has suspense without reintroducing rarity. "See what you got" implies cards from a game vary; if they do, some become rarer in practice and a chase forms. If they don't, there's no suspense and nothing to trade at the same game. | Mitigated (2026-10-28): general codes draw at scan time from a visible pool with equal odds, no tiers or rare labels. Residual: equal supply doesn't mean equal desire; accepted as healthy demand |
| H3 | Disney pin trading is a model of social, not financial, trading. It's also a large resale market with counterfeits. | Accepted as a caveat on the analogy |
| H4 | Keeping marketplace grammar out of the UI keeps a market from forming. Anything scarce and transferable can be priced elsewhere (cash swaps in person, account sales). | Accepted (2026-10-28): a third-party market may form, and we won't police it. The goal is narrower: the product never creates or rewards scarcity. "No marketplace grammar" stays, because it's about what the app tells fans matters |

**Fans and their circumstances**

| # | Assumption | Status |
|---|---|---|
| H5 | Fans have a working phone, camera and data connection at a crowded ballpark. | Partly mitigated: tokens stay claimable after the game, so a fan can claim at home |
| H6 | Remote fans have other fans nearby to trade with. A ticketless fan with no local fans can collect but never trade. | Open |
| H7 | A digital card feels like a keepsake, and the service lasts long enough to keep it. A physical card outlives its maker; a digital one doesn't. | Open |

**Kids and safety**

| # | Assumption | Status |
|---|---|---|
| H8 | People who quick-join are 13 or older. Quick join asked only for a name, while the growth loops invited kids in (the value model named a school lunch table). Collecting a child's information without a parent's consent conflicts with the "no data from kids" commitment and COPPA. Strangers trading with kids on the concourse is a related safety question. | Mitigated (2026-10-28): accounts are 13+, behind a neutral year-of-birth question; under-13s get a "hand this to a grown-up" screen that collects nothing; families share an adult account, so a parent is part of every kid's trade; kid-facing settings removed from the docs. Residual risk: the product must stay adult-run in tone and marketing, or a 13+ label won't hold (see `card-value-model.md`, section 6) |

**Business case and metrics**

| # | Assumption | Status |
|---|---|---|
| H9 | More fans is good even though tickets are the bottleneck. Growth without seats could grow frustration, unless the payoff is streaming, merch or new markets. | Open |
| H10 | Player and team pay includes bonuses tied to audience growth. Stated as fact above, but unsourced. | Open: needs a source |
| H11 | One account is one person. With name-only accounts, "one card per drop," "Pass It On only goes to new fans" and the growth metrics can all be gamed. | Partly flagged (Welcome cards, in `technical-decisions.md`); broader issue open |
| H12 | A code stands in for the moment. A live stream QR can be screenshotted and shared while the game is on; an unscanned code (in a program, say) can go home with someone or be given away. | Accepted: a code given away is still a fan bringing someone in |

**Stakeholders and framing**

| # | Assumption | Status |
|---|---|---|
| H13 | The organization would want this, existing card licensing wouldn't block it, and players would agree to their likenesses on cards. | Accepted for a thought experiment |
| H14 | The demo's audience is a fair stand-in for fans. "Shows the idea" carries as much weight as fan experience in prioritization, which is part of why stream and social drops came before families. | Accepted, and stated in `prioritization.md` |

## Deliberately out of scope for now

- **Game-day operations** (who hands out tokens, staff tools): later.
- **Trust and safety** (display-name moderation, account resale): after the
  idea itself is validated. Kids' data is the exception: it's handled now by
  the 13+ account decision (see H8).
- **Rollout plan** (pilot game to full tour): not needed for a thought
  experiment.
