# Tavern Dice

A PvP collectible-dice minigame for a D&D campaign. Each player brings 5 dice from a 52-die collection, rolls them, then spends Gold and uses dice abilities to bend the result before everything resolves at once. Matches are best of 3 rounds. Current rules: **v0.9.1**.

**The dice create the possibilities. Gold creates the decisions. The opponent creates the uncertainty.**

## What's here
| Path | What it is |
|---|---|
| [`index.html`](index.html) | The **table app**: a self-contained roller and rules engine for two players at one screen. Open it in a browser — no build step, no dependencies. |
| [`rules.md`](rules.md) | The rules (source of truth): changelog, turn structure, symbols, Gold actions, all 52 dice with faces/abilities/rarity, rarity template, formats, watch list. |
| [`sim/tavern_sim.py`](sim/tavern_sim.py) | Balance simulator (Python 3, standard library only). Defaults match the current rules; rule switches live in `RULES`. |
| [`sim/test_rules.py`](sim/test_rules.py) | Rule checks for the simulator. |
| [`sim/sim-results.md`](sim/sim-results.md) | Every simulation run (1–14) and the rules decisions it informed. |
| [`playtest-log.md`](playtest-log.md) | Tabletop playtest notes (Match 1, rules v0.3 — historical). |
| [`tests/play-match.js`](tests/play-match.js) | Playwright regression: plays a full match using only the action bar and checks for errors. |

## The collection
52 dice: 5 Basic, 23 Common, 14 Uncommon, 10 Rare. Expansion 3 "Tavern Regulars" (v0.9.1) added 12 Commons with simple automatic abilities.

## How a turn works
**Roll** (active player first) → **Influence** in two steps — **Fortune** (Reroll, Focus, Mulligan, Distract) then **Tactics** (dice abilities, Jam), alternating one action at a time, two passes end a step; Ward answers targeted actions in either step → **Resolution** (everything at once; the active player wins double KOs). Gold rolled this turn is banked at Resolution. From turn 6, Last Call drains both players and healing stops.

## The table app
- An **action bar** pinned to the bottom always shows the next step with one big button (Space presses it): Roll, Pass, Allow, Roll next turn. Players who can't act pass automatically (toggle under the Showdown); when both have passed in Tactics the turn resolves on its own.
- The player whose move it is glows; a player who must Ward or Allow glows red; the other panel dims.
- A **Turn result** card shows each player's Resolve and Gold change plus the breakdown.
- Both players side by side, with a **Showdown** panel in the middle comparing combined symbols, damage each way and the result if the turn resolved now.
- **Gold actions** panel per player: the six universal actions light up only when usable, with hover tooltips.
- Targeted actions are declared first so the opponent can Ward or Allow.
- Gold and Resolve update automatically; each meter previews the change coming at Resolution. Manual adjustments live behind **Adjust**.
- Undo, turn log, Tavern Swap between rounds, a browsable gallery of all 52 dice with rarity filters.

## Running things
```bash
# simulator
cd sim
python3 tavern_sim.py match --a Soldier,Guardian,Knight,Cleric,Oracle --b Viper,Assassin,Goblin,Undead,Archer -v
python3 tavern_sim.py field --games 2000      # per-die win rates (random loadouts)
python3 test_rules.py                         # rule checks

# table app regression (needs Playwright)
npm i -D playwright && node tests/play-match.js
```
The simulator AI is a greedy one-step player, so results are directional (≈ ±4% per die at 2,000 matches).

## Keeping things in sync
A rules change touches: `rules.md` (changelog + version), `index.html` (dice data, engine, version label), `sim/tavern_sim.py` (`FACES`, `ABIL`, `RULES`), `sim/sim-results.md` (if tested), and the printable Table Reference doc kept in Claude.

## Conventions
- **Symbols:** ⚔ Attack · 🛡 Defense · 💰 Gold · ♥ Heal · ☠ Risk · ☣ Poison · ⚡ Lightning. Code letters (sim + app): A D G H S P L; blank face = `''`.
- **Ability text:** condition → effect → exception.
- **Rarity** means moderate power plus more complexity, not bigger numbers. Sim targets: Basic 42–46% · Common 45–50% · Uncommon 48–53% · Rare 51–56%.
