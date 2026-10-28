# Banana Cards — Technical & Architecture Decisions

> Copy of `claude/technical-decisions.md` from the Banana Cards Claude project,
> as of 2026-10-28.

Engineering-facing decisions, separate from `card-value-model.md` (the
fan-facing product philosophy that drives them). See
`docs/banana-cards/01-data-model.md` in the repo for the implementation-level
schema and API routes these decisions produced.

## Current phase: demo, not product (decided 2026-10-14)

The goal right now is a demoable walkthrough of the card experience itself —
redeem a code, see it in your collection, trade in person — not a production
stack. Anything that only matters once real fans sign up is deferred to a
"before real fans" checklist rather than treated as a blocker.

Status: the demo loop is built in `apps/banana-cards` (auth, redemption,
collection view, QR-code trading, four seeded demo personas with a one-click
persona switcher on the home page in non-production builds). Run with
`npm install && npm run seed && npm run dev`.

Added 2026-10-20: the two growth loops from `card-value-model.md` (section 4)
— Pass It On cards and a no-install first trade from a fan's trade link. The
app README has a step-by-step demo script for both.

## DECISION: API-first, web client is a thin reference/testing surface

The stated end state is a mobile app, not a web app. Building web pages now is
still useful (fastest way to prove the core loops work), but they should be
treated as an internal reference client, not the product's real UI investment.
Concretely this means:

- All product logic lives in Next.js API routes (`apps/banana-cards/src/app/
  api/`), returning JSON — never logic embedded only in a page/component that
  a mobile client couldn't reuse.
- Auth uses a bearer session token the client stores and sends back
  (`Authorization: Bearer <token>`), not a browser-cookie-only session. The
  web client mirrors it into an httpOnly cookie for convenience, but the
  bearer token is the canonical mechanism.
- Any web UI built in the meantime is allowed to be plain/functional — it is
  not the thing fans will eventually use.

## DECISION: email + one-time code auth, with a persistent "stay signed in" session

Chosen over lightweight device-only identity (rejected: no recovery path) and
SMS (rejected: real per-message cost, fights the breakeven mandate) and
piggybacking on an existing team account system (not yet confirmed to exist).

- A fan enters their email, receives a one-time code, enters it to verify.
  First-time verification creates the `fans` row (with a chosen display
  name); a returning email logs into the existing one.
- Built as a typed numeric code (not a clickable magic link), 10-minute
  expiry. Works identically on web and mobile with no deep-link plumbing.
- Sessions last 90 days ("stay signed in"); sign-out revokes the session.

**Demo stand-in for email delivery:** no email service is wired up. In dev,
`request-code` returns the code in the response (`devCode`) instead of
sending it, and the demo persona switcher uses that to sign in with one
click. Everything downstream of sign-in (redemption, collection, trading)
uses the same session token either way, so swapping in real delivery later
only touches the code-sending step.

## DECISION (demo): name-only quick join from a scanned QR code (2026-10-20)

Someone new who scans a fan's trade or pass-it-on QR code joins with just a
display name — no email, no app install — so they're in before the moment
passes. They get the same session token as email sign-in, so everything
downstream treats them identically. The trade-off: a quick-join account has
no email, so it can't be recovered or used on another device yet.

As of 2026-10-28, quick join is preceded by the age question below.

## DECISION: accounts are 13+, behind a neutral age question (2026-10-28)

Product rationale is in `card-value-model.md`, section 6. Engineering shape:

- **One age step on every account-creation path:** email sign-up, quick join
  from a trade or Pass It On QR, and a new fan redeeming a token or drop. It's
  the first screen, before the name or email field.
- **Neutral:** "What year were you born?" with no pre-filled or defaulted
  year, no mention of a minimum age, and no "I'm 13+" checkbox.
- **Nothing collected first.** The age answer is checked before any other
  personal information is accepted. The API enforces this, not just the UI:
  account-creation routes reject requests without a passing age step.
- **Under 13 → dead end that collects nothing.** No account, no name, no
  device identifier saved against the person. The screen asks them to hand the
  phone to a grown-up. The QR they scanned is unchanged, so a grown-up scanning
  it gets the normal flow (a Pass It On QR's 15-minute window still applies).
- **No retry by changing the year in the same flow.** After an under-13
  answer, the client doesn't offer a "go back" to the age field for that
  session, so the screen doesn't teach kids to change their answer.
- **Store the minimum:** an "is 13+" flag on the `fans` row, not the birth
  year (open question in the value model; flag is the default).
- **Family use needs nothing new:** a family shares one adult account. Kid
  profiles are deferred; keep the schema open to adding profiles under an
  account later rather than assuming one person per account forever.

Not legal advice: the age screen should get a lawyer's review before real
fans (see below).

## DECISION (demo): drops for live streams and social posts (2026-10-24)

Stream and social cards are handed out through one mechanism, a drop: a link
(the QR on a stream's overlay, or a player's or team's post) that ends in the
same reveal as a token. A stream drop works only while it's marked live; a
social drop until its end date. In the demo, a dev-only drop console stands in
for the stream producer's go-live switch and a player's post; it's turned off
in production because there are no team, player or staff accounts yet.

## DECISION: codes resolve to a pool or to a specific card (2026-10-28)

Product rationale is in `card-value-model.md`, "DECISION: pool cards and moment
cards." Engineering shape:

- **Two code kinds.** A *pool code* points to a pool; a *moment code* points to
  one card. Any channel (game, stream drop, social drop) can issue either.
- **Pool draws happen at redemption.** The card is chosen when the code is
  scanned, uniformly at random from the pool at that moment. Codes don't carry a
  card, so print runs need unique codes only.
- **No weights in the schema.** Pools have members, not odds. Leaving out a
  weight field is deliberate: equal odds is a product rule, and the data model
  shouldn't make breaking it a one-line change.
- **Pools are built from series.** A series is a set of cards (e.g. a team's
  roster, or an anime-style run across every player); a pool is one or more
  series, plus optional tour-stop cards. A code can target a whole team pool or
  a single series.
- **Tradeability comes from the card's kind.** Pool cards are tradeable; moment
  cards (and Pass It On cards) aren't. The trade API refuses non-tradeable cards,
  and the trade UI doesn't offer them.
- **Sets reference pool cards only.** Moment cards appear on a separate
  Keepsakes shelf in the collection response.
- **Games attended (optional extra):** derived from redemptions of codes issued
  at a game, not stored separately.

Built in the demo (2026-10-28): moment cards as keepsakes. A
`card_templates.keepsake` flag marks a card that can't be traded; the trade
API refuses it and the trade screen never offers it; the collection shows a
Keepsakes shelf; the reveal says it stays with you. Example: Ringmaster's
Signed Hat (codes `BB-HAT-001`/`002`), and Peel Master Flex holds one.

Still to bring the demo in line (not "before real fans"):
- General codes draw at scan time from a pool; today every demo code still
  maps to one specific card
- Redefine the "Watched Live" and "Following Along" sets: sets hold pool cards
  only, so their cards either become a pool series or move to Keepsakes

## Before real fans (deferred from the demo phase)

- Tools for players and teams to design moment cards, create series, and issue
  codes (likeness approval, art, code counts)

- Build the 13+ age step (above) on every account-creation path, including
  API enforcement, and have a lawyer review it against the COPPA rule
- Migrate demo accounts: seeded personas get the 13+ flag; any account created
  before the age step existed has to answer it on next sign-in
- Accounts and tools for the people behind drops: stream producers (going live
  should follow the actual stream, not a manual switch) and players and teams
  (creating a drop, setting its end date, posting it)
- Pick an email-sending service and replace the `devCode` echo with real
  delivery (and make sure `devCode` can never be returned in production)
- Let a quick-join fan add an email later so they can keep their cards on a
  new phone (otherwise losing the phone or clearing the browser loses the
  collection)
- Abuse limits on quick join: anyone with a fan's trade link can create
  name-only accounts, and each one joining from a trade link gets a Welcome
  card. Fine for a demo; needs rate limits or a lightweight check before launch
- Decide whether to add "Sign in with Apple/Google" alongside or instead of
  email codes
- Confirm whether an existing Bananas ticketing/membership account system
  exists that auth should integrate with instead of being fully custom
- Whether "sign out everywhere" is needed for v1
- Real in-app camera QR scanning in the mobile client (today a phone's own
  camera app opens the QR links; no backend change needed either way)
