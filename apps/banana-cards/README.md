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

## Demo script: getting a card at the gate

1. Open **print or scan demo tokens** from the home page (or go to `/tokens`).
   Each token is a QR code standing in for one handed out at the ballpark.
2. Open a token's link in a private window (or scan it with a phone; see
   below). As a new fan, type a name and tap **Claim my card**.
3. The card waits face down. Tap **Tap to reveal your card** to flip it and see
   what you got, then your progress in its set and the first-card Pass It On
   bonus.

## Demo script: beyond the ballpark (live streams and social drops)

1. Open the **drop console** from the home page (or go to `/drops`).
2. **Live stream:** "Bananas vs Firefighters" is live. Open its link in a
   private window (the QR is what viewers would scan off the broadcast), type a
   name, and reveal the card: it's labeled "Watched live on the Banana Ball stream". Back in the console, click **End stream** and open the link
   again: it now says stream cards can only be claimed while the game is on.
3. **Social drop:** open Static's "Dugout selfie" post link. The card is
   labeled "From Static's drop". Opening it a second time says it's one per
   fan.
4. In **My collection**, the "Watched Live" and "Following Along" sets track
   these cards. The 9/12 stream has already ended, so its card (Zesty has one)
   can only be traded for.

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
