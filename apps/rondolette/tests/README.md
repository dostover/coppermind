# Rondolette tests

Two scripts, both run against a test copy of `../index.html` in headless Chromium.
Neither touches the real Firebase project: `mock-firebase.js` stands in for it.

## Setup

```bash
npm install --no-save playwright
npx playwright install chromium
```

Run from the repo root (or anywhere; paths resolve from this folder).

## Multiplayer end-to-end

```bash
node apps/rondolette/tests/multiplayer.test.cjs            # headless
node apps/rondolette/tests/multiplayer.test.cjs --headed   # watch it play
```

Three pages share the mocked database and play through: create a table, open the
invite link, take seats, sync settings, start, watch a spin live, pass the turn,
force a win (banner on both screens), play again, reject a bad code and join by
code as a watcher. It prints PASS/FAIL per check and exits 1 on any failure.

## Physics tuning

```bash
node apps/rondolette/tests/tune-physics.cjs --spins 80 --sets '[{}, {"WELL":30}]'
```

Runs random spins for each set of `PHYS` overrides and prints balls scored,
points, crashes, time before a ball drops, balls off the board and spin length
per spin. Compare a change against `{}` (the current settings) in the same run;
see `docs/rondolette/README.md` for the tuning history and current targets.

## How the test copy is built

`_build.cjs` removes the Firebase CDN scripts, loads `mock-firebase.js`
instead, and adds a hook to `turnResult()` so a test can force a spin's
outcome (`window.__fake = () => ({ total, scored, ... })`). The tuning script
also adds counters at a few anchor lines; if `index.html` changes and an anchor
no longer matches, the script says which one to update.
