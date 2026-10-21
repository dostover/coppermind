# Banana Cards — Technical & Architecture Decisions

> Copy of `claude/technical-decisions.md` from the Banana Cards Claude project,
> as of 2026-10-20.

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

## Before real fans (deferred from the demo phase)

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
