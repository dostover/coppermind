# Rondolette design notes

How the game came together, what was tried, and why things are the way they
are. The code lives in [`apps/rondolette`](../../apps/rondolette/).

## Starting point

Tiroler Roulette is a wooden table game: a bowl sloping toward the centre, a
spinning top, and six balls (four plain, one red that doubles, one that
subtracts). Players flick the top; as it slows it wanders, strikes the balls
and sends them circling the bowl into scoring hollows. The goal was a faithful
digital board that feels like the real thing, playable by friends in different
places.

Early decisions:

- **Top-down 2D physics** rather than 3D or a randomized "spin animation".
  Outcomes have to come from real collisions or the game isn't fun.
- **Drag to flick**: press where the top goes down, drag for direction and
  power. The drag length sets both launch speed and spin.
- **One self-contained HTML file**, so it can run anywhere and be hosted for
  free.

## Physics model

All in logical board units (the board is 600 × 600; the bowl radius is 190).

| Part | Model |
| --- | --- |
| Bowl slope | Acceleration toward the centre, proportional to distance (`SLOPE` 160) |
| Rolling | Constant rolling resistance plus speed-proportional drag (`ROLL` 5, `DRAG` 0.1) |
| Ball–ball | Equal-mass elastic collisions, restitution 0.95 |
| Bowl wall | Reflection with restitution ≈ 0.65 |
| Hollows | 8 recessed wells, evenly spaced at 45°; within 22 px a ball is pulled toward the centre (`WELL` 38); it drops in when within 7 px **and** slower than 150 px/s |
| Corner boxes | 4 gaps in the rim on the diagonals; a ball through a gap rolls down the channel into the box |
| Top | Mass 5× a ball; spin decays with a constant plus spin-proportional term; random-walk wander (Ornstein–Uhlenbeck) that grows as spin drops; slight gyroscopic curl; topples below a spin threshold |
| Top–ball contact | Normal impulse plus a tangential "spin kick" from the top's surface speed, capped per contact |

The simulation runs 8 sub-steps per animation frame. A spin ends when the top
has fallen and every ball has settled, or 10 seconds after the top falls.

## Tuning history

Each change was measured with the headless harness (`window.__tyrolTest(n)`,
80–100 random spins per setting) and then play-tested.

| Change | Result | Kept? |
| --- | --- | --- |
| First pass: hollows cut into the rim, strong capture | ~0.5 balls/spin; tops died in 3 s pressed against the wall | Fixed spin loss at the wall |
| Dimple pull around hollows, tangential-speed capture | ~2 balls, ~100 points per spin | Yes |
| Balls hop (vertical bounce, knocked out of hollows) | Too bouncy | Reverted |
| Halfway hop setting | "Wrong direction" | Reverted to no hopping |
| Lower rolling friction | Balls coast farther | Yes |
| Steeper bowl, harder capture, less friction | Crashes per spin ~6 → ~15; balls roll ~8 s before dropping | Yes |
| Smaller bowl (radius 210 → 190) | Liked the size; scoring too easy | Kept, then reduced pull |
| Hollows recessed into the bowl floor, evenly on a circle | Matches real boards | Yes, with stronger pull to compensate |
| 8-ball variant | Tried as a toggle | Removed |

Current measurements: about 1.7 balls and 90–120 points per spin, about 15
ball-on-ball crashes per spin, and about 28 seconds per spin.

## Multiplayer

### First attempt: inside a Claude artifact

The game was prototyped as a Claude artifact, and the first multiplayer version
used the artifact platform's shared database and live "room". It worked in
testing, but on a personal Claude plan an artifact can only be shared as
"anyone with the link", and link visitors can't write shared data or join the
live room. Playing with friends across the country needed something else.

### Hosted version: Firebase + Netlify

The same design moved to Firebase Realtime Database with anonymous auth, hosted
as a static site:

- **One authority per spin.** Only the active player's browser runs the
  physics. It publishes the board (balls, top, aim arrow, phase) to its peer
  entry about 12 times a second; watchers ease toward each update, so motion
  looks smooth at 60 fps. Watchers also hear drops and the top hum.
- **Transactions for game state.** Seat changes, settings, starting a game,
  scoring a spin and skipping a turn all run as transactions on
  `rooms/<CODE>/table`. Each write checks the current `turnId`, so a spin can't
  be recorded twice.
- **Shared scoring.** One `scoreTurn()` function scores the local game and the
  online table, including spin-off tie-breaks and the red rule.
- **Presence.** Each open tab writes `rooms/<CODE>/peers/<tab>` with an
  `onDisconnect().remove()`. The scorecard shows who's here; if the active
  player has gone, others can skip their turn (scored as 0). In the lobby,
  seats of absent players can be removed.
- **Table codes and invite links.** A table code like `ALPS-4821` goes in the
  URL (`?t=ALPS-4821`); opening the link goes straight to that table.

### Testing

Both multiplayer backends were tested with Playwright driving two or three
browser pages at once against a local stand-in for the backend (an in-memory
database shared between pages over `BroadcastChannel`). Scenarios covered:
creating and joining tables, seating and settings, live aim and spin watching,
results on every screen, turn passing, bonus spins, wins, play-again, skip,
lobby return, bad codes and viewer-only access.

## Known limits and ideas

- Clients are trusted: any signed-in player can write any room. Fine for
  friends; a public game would want server-side validation (Cloud Functions)
  or per-room rules.
- The active player's tab must stay in the foreground while spinning, because
  the browser pauses animation in background tabs.
- Hollow point values are this version's own; the traditional boards vary.
- Ideas: a Discord Activity wrapper, spectator chat, saved game history.
