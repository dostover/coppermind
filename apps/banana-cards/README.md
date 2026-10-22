# Banana Cards

Digital trading card system and portal for Banana Ball.

## Status

Demo of the core card experience: sign in, redeem a code, browse your
collection, trade in person by QR code, and the two fan-base-building loops
(Pass It On cards and a no-install first trade from someone's trade link),
plus sets that unlock small perks when you finish them.
No email service is wired up yet; in development the sign-in code is shown
on screen. See `../../docs/banana-cards/01-data-model.md` for how it all
works.

## Getting started

```bash
npm install
npm run seed   # wipes and recreates demo data, including four demo fans
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and use the demo fan
buttons on the home page to switch between fans with one click.

## Demo script: bringing a new fan in

1. Sign in as **Sluggo** and open **Trade with a fan**.
2. Under **Pass it on**, tap **Show pass-it-on code**.
3. Open that link in a private window (or scan the QR with a second phone),
   type a name, and tap **Claim my card**. The card is theirs, marked as a gift
   from Sluggo.
4. In another private window, open Sluggo's trade link (shown under his QR
   code). Type a name and tap **Join and trade**: the new fan gets a Welcome to
   Banana Ball card and lands in a trade with Sluggo. Propose a swap, then
   confirm it as Sluggo.

## Demo script: finishing a set

1. Sign in as **Peel Master Flex** and open **My collection**: the "One Night
   at Grayson · 9/12" set is finished and its perk is unlocked.
2. Switch to **Rookie Nanas**, open **Trade with a fan**, and look up Peel's
   code. His First Home Run card is marked "For your set". Propose a swap,
   then confirm it as Peel (his set drops back to 2 of 3).
3. As Rookie Nanas, redeem `BB-CHAR-001`. The confirmation says the set is
   complete, and the collection shows the perk unlocked.

To use real phones, run the server on your local network
(`npm run dev -- -H 0.0.0.0`) and open it from the computer by its network
address (e.g. `http://192.168.1.20:3000`) so the QR codes carry an address
the phones can reach. If the phone shows a blank or unstyled page, add that
address to `allowedDevOrigins` in `next.config.ts`.
