# Tavern Dice — Simulator Results

Simulator: `claude/tavern_sim.py` (all 24 abilities, all Gold abilities incl. Ward, Last Call, double-KO rules; rule switches in `RULES`). Both sides use the same greedy AI (best expected outcome for the current round; 1 Gold ≈ 0.5 Resolve; trailing players weight survival). Treat results as directional.

## Run 17 — v0.10 confirmation: Closing Time 8 + Mend + new Triage (2026-10-07)
1,500 random Open matches (52 dice, bench 6; ≈290 appearances per die, ±6%) + 200 games per matchup. Sawbones' Triage now = "this die's ♥ can also mend Closing Time".
- Average round 6.2 turns (longest 17); median match 14 turns; the clock reaches 32% of rounds and decides 15% (was 52% / 23% under Last Call).
- Matchups: Shields vs Strikers 78%, Healers vs Strikers 50%, Healers vs Gold aggro 63% (Run 16 said 71%; within noise — still a mild watch).
- Tier averages: Basic 43%, Common 50%, Uncommon 50%, Rare 54% — on target.
- Sawbones 50% with the new Triage (fine). Barkeep 42% — Last Orders now starts on turn 8, so it fires less; candidate for a buff.
- Hot (pre-existing, not changed): Druid 64%, Paladin 61%, Bard 61%, Assassin 60%, Elemental 60%. Low: Mimic 42%, Mage 43%, Taxman 43%.
- Raw data: `results25.json`.

## Run 16 — rethinking healing and the clock (2026-10-07) → option E adopted as v0.10
Designer feedback: Last Call at turn 6 decides too many rounds; wants a gentle "lose 1 per turn after a while". Tested five setups (v0.9.1 rules otherwise, 52 dice): 600 random Open matches each (bench 6) + 150 games per themed matchup (±8%).
- **Closing Time** = flat 1 Resolve per turn from turn N, healing still allowed (replaces escalating Last Call + no-heal).
- **Mend** = each ♥ only restores Resolve lost this turn (can't go above where you started the turn). Sawbones' ♥ may heal 1 above (stand-in for a new Triage).

| | A: now (Last Call 6) | B: Closing Time 8 | C: CT 8 + Mend | D: CT 9 + Mend | **E: CT 8 + Mend, clock can't be mended** |
|---|---|---|---|---|---|
| Avg round length | 5.5 turns | 6.9 | 6.5 | 6.6 | **6.2** |
| Longest round | 9 | 40 (stalls) | 40 (stalls) | 40 (stalls) | **17** |
| Rounds the clock reaches | 52% | 35% | 31% | 25% | **32%** |
| Rounds the clock decides* | 23% | 15% | 13% | 11% | **14%** |
| Healers vs Strikers | 48% | 68% | 54% | 58% | **47%** |
| Healers vs Gold aggro | 57% | 80% | 71% | 69% | **71%** |
| Shields vs Strikers | 69% | 72% | 68% | 68% | **69%** |
| Tier avg (B/C/U/R) | 39/49/49/58 | 39/49/50/57 | 37/50/50/56 | 37/50/51/56 | **38/49/51/56** |

\*Loser would have survived that final turn without the clock's damage.
- **B** (just flattening the clock) brings back stalls: healing out-paces 1 damage a turn and rounds can run to the 40-turn cap. Healers dominate.
- **C/D**: Mend helps, but if ♥ can cancel the clock's 1 damage, heal-heavy mirrors still stall.
- **E** works: rounds a bit longer, no stalls (max 17), the clock decides 14% of rounds instead of 23%, tier balance unchanged, healers about even with attack loadouts. Healers vs Gold aggro rises (57%→71%, ±8%) — watch.
- Defensive mirror (Shields vs Healers) is ~1–13% in every setup — the shield wall has almost no damage; separate issue. Sawbones' stand-in "heal 1 above" acts as regen in slow mirrors; a different Triage is likely better.
- Raw data: `results24.json`.

## Run 15 — Last Call start: turn 6 vs 8 vs 10 (2026-10-07) → exploratory, not adopted
v0.9.1 rules, 52 dice. Per setting: 1,000 random Open matches (bench 6) + 200 games for each of five themed matchups. Per-die rates at this size are ±7%, so only big or aggregate shifts are meaningful.

| | Turn 6 (current) | Turn 8 | Turn 10 |
|---|---|---|---|
| Median match length | 13 turns | 14 | 15 |
| Average round length | 5.5 turns | 6.2 | 6.7 |
| Rounds that reach Last Call | 54% | 37% | 27% |
| Rounds lasting 10+ turns | 0% | 13% | 27% (longest 13) |
| Healers vs Strikers | 48% | 60% | 66% |
| Healers vs Gold aggro | 51% | 60% | 67% |
| Shield wall vs Strikers | 80% | 80% | 80% |
| Gold actions per match (Reroll+Focus+Mulligan+Distract) | 11.8 | — | 15.6 |
| Tier averages (B / C / U / R) | 43 / 49 / 50 / 56% | 43 / 49 / 50 / 56% | 44 / 49 / 52 / 55% |

Lineups: Healers = Cleric, Sawbones, Pilgrim, Cook, Druid · Strikers = Archer, Assassin, Mage, Elemental, Monster · Gold aggro = Gambler, Dragon, Mage, Assassin, Berserker · Shield wall = Soldier, Guardian, Knight, Cleric, Paladin.
- The main effect is healing: "no healing from turn 6" is what keeps heal-heavy loadouts in check. Pushed to turn 10, healing loadouts go from even to ~2:1 favourites.
- Tier balance barely moves; rounds get ~20% longer and more Gold gets spent.
- Side finding: the Soldier/Guardian/Knight/Cleric/Paladin shield wall wins ~80% against Strikers at every setting — worth a look on its own.
- Idea not yet tested: split Last Call — keep "no healing" at turn 6, start the Resolve drain later.
- Raw data: `results23.json`.

## Run 14 — Expansion 3 "Tavern Regulars": 12 Common dice (2026-10-07) → v0.9.1
Target: Common 45–50% (Open format). **First pass:** 3,000 random Open matches with all 52 dice (v0.9 rules, bench 6; ~575 appearances per die, margin ≈ ±4%; median 13 turns). **Tuning:** each miss got a one-face change, then a targeted retest (test die always in loadout A plus 4 random, random opponent, 600 matches, seats alternated).

| Die | First pass | Final | Change |
|---|---|---|---|
| Bouncer | 52% | 47% | [🛡🛡] → [🛡] (unchanged it re-measured 53.5% targeted) |
| Cook | 49% | 49% | — |
| Minstrel | 58% | 52% | [💰♥] → [💰] |
| Brewer | 58% | 47% | [💰♥] → [💰] |
| Drunkard | 55% | 51% | [⚔🛡] → [⚔] |
| Watchman | 49% | 49% | — |
| Smith | 56% | 49% | [⚔⚔] → [⚔] |
| Cardsharp | 48% | 48% | — |
| Ratcatcher | 47% | 47% | — |
| Fisher | 43% | 52% | [♥] → [🛡♥] |
| Militia | 55% | 51% | [⚔🛡] → [⚔] |
| Herbalist | 48% | 48% | — |

- Simple +1 passives that trigger often (♥-triggered Rousing Tune and Strong Brew, Sunder vs any shield wall) were worth more than the template's "+1 symbol"; those dice needed a symbol removed.
- **Existing dice in the 52-die pool (first pass):** tier averages Basic 42%, Common (old) 50%, Uncommon 49%, Rare 54%. Hot: Druid 63%, Bard 58%, Paladin 57%, Assassin 56%. Not changed — existing dice stay as they are.
- Raw data: `results20.json` (field), `results21.json` and `results22.json` (targeted).

## Run 13 — two-step Influence: Fortune then Tactics (2026-10-07) → adopted as v0.9
2,000 random Open matches (40 dice, v0.8 rules, swap 2, bench 6) + 150 per themed matchup, for each version.
- **First pass (greedy AI, no Gold saving):** the AI spent all its Gold in Fortune and almost stopped using abilities (Wild Shape 0.91→0.15 uses per match, Envenom 0.18→0.03), so Gold-ability loadouts collapsed (e.g. Flex vs Venom 45%→28%). Not a fair test — real players save Gold for Tactics.
- **Rerun with a simple reserve** (in Fortune, keep up to 2 Gold if the loadout has Gold-activated abilities):

| | One window (v0.8) | Two steps (v0.9) |
|---|---|---|
| Avg. matchup distance from 50/50 | 8.2 pts | 9.7 pts |
| Dice win-rate range | 42–60% | 41–59% |
| Median turns per match | 12 | 11 |
| Round won by first-active player | 48.6% | 48.2% |
| Distract uses per match | 4.8 | 1.7 |
| Wild Shape uses per match | 0.91 | 1.31 |

Biggest movers: Mage 48→42%, Gambler 49→44%, Dragon 54→50%, Moneylender 48→45%, Warlock 52→49%, Stormcaller 45→48%, Knight 47→50%, Paladin 55→59%, Soldier 50→54%, Sawbones 51→56%.

| Matchup (first listed wins) | One window | Two steps |
|---|---|---|
| Defense vs GoldAggro | 59% | 61% |
| Defense vs Skulls | 55% | 60% |
| Defense vs Flex | 45% | 45% |
| Defense vs Strikers | 69% | 66% |
| Defense vs Venom | 45% | 54% |
| GoldAggro vs Skulls | 45% | 39% |
| GoldAggro vs Flex | 43% | 33% |
| GoldAggro vs Strikers | 39% | 44% |
| GoldAggro vs Venom | 38% | 37% |
| Skulls vs Flex | 45% | 41% |
| Skulls vs Strikers | 39% | 40% |
| Skulls vs Venom | 33% | 39% |
| Flex vs Strikers | 44% | 55% |
| Flex vs Venom | 45% | 63% |
| Strikers vs Venom | 49% | 54% |

**Findings:** roughly balance-neutral overall. Face-changers did **not** get stronger (Druid 60→59%). Gold-hungry attack dice lost the most (Mage, Gambler, Dragon, Moneylender); defensive dice (Soldier, Paladin, Knight, Sawbones) gained 3–5 points. The decision "spend Gold on rerolls now or save it for abilities" is real — the sim only works when players plan for it. Watch Mage (42%).

## Run 12 — Expansion 2 "Coin & Cure" (2026-10-06)
2,400 random Open matches with all 40 dice (v0.7 rules, swap 2, bench 6), then 800 targeted matches each for the two retuned dice. Margin ±4%.

| Die | Tier | Target | First pass | Final |
|---|---|---|---|---|
| Pilgrim | Basic | 42–46% | 38% ([♥][♥][🛡][⚔][💰][ ]) | 39% ([♥][♥][🛡][⚔][⚔][ ]) — in line with other Basics |
| Barkeep | Common | 45–50% | 49% | 49% |
| Moneylender | Uncommon | 48–53% | 50% | 50% |
| Taxman | Uncommon | 48–53% | 48% | 48% |
| Sawbones | Uncommon | 48–53% | 47% (no 🛡🛡) → 59% (☠ removed) | 51% ([🛡]→[🛡🛡], ☠ kept) |
| Puppeteer | Rare | 51–56% | 56% | 56% |
| Hydra | Rare | 51–56% | 56% | 56% |

Other notes: with 40 dice the Basic tier slid to ~39–42% (Brawler 42%, Shieldbearer 40%, Peddler 42%). Top dice: Elemental 60%, Druid 59%, Assassin 59%, Bard 57%. Loan used 0.12×/match, Strings 0.48×, Toxin Coat 0.48×. Median 12 turns per match.

## Run 11 — Expansion 1 dice from the rarity template (2026-10-06)
2,000 random Open matches, v0.7 rules (swap 2, bench 6), 33 dice. Margin ±4% per die.

| Die | Tier | Target | Win rate |
|---|---|---|---|
| Brawler | Basic | 42–46% | 41.7% |
| Shieldbearer | Basic | 42–46% | 45.9% |
| Peddler | Basic | 42–46% | 41.8% |
| Stormcaller | Common | 45–50% | 47.5% |
| Apothecary | Uncommon | 48–53% | 53.6% |
| Tempest | Rare | 51–56% | 51.8% |
| Plaguebringer | Rare | 51–56% | 55.2% |

Tier averages with the expansion: Basic 44%, Common 49.5%, Uncommon 50.3%, Rare 53%. Toxin Coat used 0.6×/match.
All seven land in or within ~1 point of their tier range — inside the margin of error. Watch Apothecary (top edge) and Brawler/Peddler (bottom edge) in playtests.

## Run 10 — healing stops during Last Call, and swapping 2 dice (2026-10-06)
Rules v0.6, match format. 1,200 random matches + 150 per themed matchup per option. "No-heal" = from turn 6 of a round, ♥ restores nothing.

| Option | Avg. matchup distance from 50/50 | Defense vs Flex | Dice range | Median turns/match |
|---|---|---|---|---|
| v0.6 (swap 1, bench 3) | 12.5 pts | 1% | 43–59% | 12 |
| No-heal (swap 1, bench 3) | 9.6 pts | 37% | 41–58% | 12 |
| Swap 2 (bench 6) | 10.5 pts | 7% | 43–60% | 13 |
| Swap 3 (bench 6, Run 9) | 9.0 pts | 5% | 41–61% | 13 |
| **No-heal + swap 2 (bench 6)** | **5.7 pts** | **49%** | 42–58% | 13 |

| Matchup (first listed wins) | v0.6 | No-heal | Swap 2 | No-heal + swap 2 |
|---|---|---|---|---|
| Defense vs GoldAggro | 70% | 70% | 63% | 62% |
| Defense vs Skulls | 59% | 53% | 54% | 57% |
| Defense vs Flex | 1% | 37% | 7% | 49% |
| Defense vs Strikers | 78% | 77% | 65% | 67% |
| Defense vs Venom | 54% | 53% | 52% | 50% |
| GoldAggro vs Skulls | 40% | 38% | 49% | 48% |
| GoldAggro vs Flex | 43% | 51% | 31% | 41% |
| GoldAggro vs Strikers | 34% | 35% | 48% | 48% |
| GoldAggro vs Venom | 40% | 35% | 42% | 41% |
| Skulls vs Flex | 48% | 54% | 38% | 45% |
| Skulls vs Strikers | 41% | 43% | 52% | 53% |
| Skulls vs Venom | 38% | 39% | 43% | 43% |
| Flex vs Strikers | 46% | 46% | 55% | 54% |
| Flex vs Venom | 56% | 45% | 67% | 49% |
| Strikers vs Venom | 51% | 47% | 58% | 57% |

**Findings**
- No-heal during Last Call fixes the healing stall directly: Defense vs Flex 1% → 37%. Alchemist (pure healing/economy) drops 58% → 45%.
- Swapping 2 dice on its own helps overall balance a little but not the healing matchup.
- **Together they give the best balance measured so far:** every themed matchup between 41% and 67%, average 5.7 points from even. Bard (58%) and Elemental (57%) top; Oracle (42%) bottom.
- Swap results assume players have about 6 spare dice; with fewer, Tavern Swap matters less.

## Run 9 — bigger Tavern Swap and anti-healing tools (2026-10-06, not adopted)
Rules v0.6, match format. 1,200 random matches + 150 per themed matchup per option. Bench = spare dice each player can swap in.

| Option | Avg. matchup distance from 50/50 | Defense vs Flex | Dice range | Median turns/match |
|---|---|---|---|---|
| v0.6 (swap 1, bench 3) | 12.5 pts | 1% | 43–59% | 12 |
| Swap 1, bench 6 | 11.9 pts | 4% | 42–59% | 12 |
| **Swap 3, bench 6** | **9.0 pts** | 5% | 41–61% | 13 |
| Anti-healing dice (swap 1, bench 3) | 13.2 pts | 1% | 41–64% | 12 |

Anti-healing dice tested: **Inquisitor's Die** [🛡][🛡][⚔][⚔🛡][💰][☠] with Judgement (= Envenom on a defensive die) — 41% win rate, and Defense with Inquisitor instead of Oracle still beat Flex only 2%. **Dwarven Grudge** (+1 damage if opponent shows ♥, replacing Stubborn) — Dwarven rose 43% → 55%, but Defense with Dwarven beat Flex only 10%.

**Why Defense loses to Flex** (60 single rounds): rounds last ~10 turns and Last Call decides them. Per round, Flex heals 21 and deals 1.7 damage; Defense deals 4.8 (incl. Counterattack), heals 10, and takes 3 from its own ☠. Flex has ♥ on all five dice plus face-changing abilities to make more, so stopping one die's healing per turn doesn't matter; Defense can't out-damage ~2 healing per turn.

**Findings**
- Swapping 3 dice is the best lever tested for overall matchup balance (12.5 → 9 points), but it doesn't flip lopsided matchups and makes the loadout choice matter less.
- More Envenom-style abilities don't fix the Defense vs healing problem. Next idea to test: **healing stops during Last Call** (from turn 6, ♥ restores nothing), which ends sustain stalls directly.

## Run 8 — v0.6 turn order and best-of-3 matches (2026-10-06)
v0.6: matches are best of 3 rounds; each round is played to 0 Resolve in turns. Active player random at start, switches every turn; loser of a round is active first next round. Influence alternates one action at a time, active player first. Double KO → active player wins. Resolve/Gold reset each round. Tavern Swap before rounds 2 and 3 (3-die bench in the sim).
3,000 random matches + 300 matches per themed matchup. Win rates below are **match** wins.

- **Length:** median 12 turns per match (90th pct 20); 2.44 rounds per match; 44% of matches go to round 3.
- **Active-player edge:** the player active on a round's first turn won 47.6% of rounds. That player is usually the previous round's loser, so the small deficit reflects that; there is no sign of a large first-player advantage. 20% of rounds end in a double KO decided by the active player.
- **Best of 3 sharpens matchups:** average themed matchup distance from 50/50 rose from 9 to 12.5 points, and dice spread widened from 44–56% to 43–59%. Healing dice (Cleric, Alchemist, Druid) gained the most.

| Die | v0.5.1 single round | v0.6 match |
|---|---|---|
| Elemental | 56% | 59% |
| Druid | 55% | 59% |
| Cleric | 55% | 58% |
| Alchemist | 53% | 58% |
| Bard | 56% | 57% |
| Warlock | 54% | 55% |
| Gambler | 53% | 55% |
| Paladin | 53% | 53% |
| Viper | 0% | 52% |
| Archer | 52% | 52% |
| Assassin | 53% | 52% |
| Guardian | 52% | 51% |
| Soldier | 50% | 50% |
| Knight | 50% | 50% |
| Dragon | 48% | 49% |
| Undead | 48% | 48% |
| Oracle | 48% | 47% |
| Fey | 47% | 45% |
| Mage | 47% | 45% |
| Thief | 46% | 44% |
| Goblin | 47% | 44% |
| Monster | 47% | 44% |
| Mimic | 45% | 44% |
| Basic | 44% | 44% |
| Berserker | 46% | 44% |
| Dwarven | 44% | 43% |

| Matchup (first listed wins) | v0.5.1 single round | v0.6 match |
|---|---|---|
| Defense vs GoldAggro | 61% | 70% |
| Defense vs Skulls | 47% | 59% |
| Defense vs Flex | 15% | 1% |
| Defense vs Strikers | 69% | 78% |
| Defense vs Venom | 46% | 54% |
| GoldAggro vs Skulls | 51% | 40% |
| GoldAggro vs Flex | 52% | 43% |
| GoldAggro vs Strikers | 36% | 34% |
| GoldAggro vs Venom | 40% | 40% |
| Skulls vs Flex | 50% | 48% |
| Skulls vs Strikers | 40% | 41% |
| Skulls vs Venom | 38% | 38% |
| Flex vs Strikers | 47% | 46% |
| Flex vs Venom | 49% | 56% |
| Strikers vs Venom | 57% | 51% |

**Watch:** Defense now loses to the Flex/healing loadout ~99% of matches. A match takes ~2.4× as long as a v0.5.1 game — check session time at the table.

## Run 7 — v0.5 + balance pass + Tavern Swap (2026-10-06) → adopted as v0.5.1
v0.5 = Run 6 version B, Dragon's ☠ restored, Basic Die [🛡][🛡][⚔][⚔][💰][💰] added (26 dice).
Balance pass: Elemental [⚔⚔]→[⚔] · Omen free Reroll only on the Oracle itself · Monster one ☠→⚔ · Berserker one ⚔→⚔⚔ · Gambler [☠☠]→[☠] · Envenom tested free (0 Gold) and at 1 Gold.
Tavern Swap: once per match from round 2, swap one loadout die for one of 3 random bench dice (sim AI swaps when a 60-roll estimate improves by >0.5; ~1 swap per player per game).
4,000 field games + 400 per matchup.

| | v0.5 | + fixes (free Envenom) | + fixes + Swap (free Envenom) | **final: + fixes + Swap, Envenom 1 Gold** |
|---|---|---|---|---|
| Die win-rate range | 41–65% | 42–62% | 43–62% | **44–56%** |
| Elemental | 65% | 60% | 56% | 56% |
| Oracle | 61% | 45% | 47% | 48% |
| Viper | 51% | 62% | 62% | 52% |
| Gambler / Monster / Berserker | 45 / 44 / 46% | 51 / 49 / 48% | 53 / 47 / 45% | 54 / 47 / 46% |
| Basic | 42% | 43% | 45% | 44% |
| Avg. themed matchup distance from 50% | 23 pts | 18 pts | 12 pts | **9 pts** |

Final matchups: Defense vs GoldAggro 61% · vs Skulls 47% · vs Strikers 69% · vs Venom 46% · **vs Flex 15%** · GoldAggro vs Skulls 51% · vs Flex 52% · vs Strikers 36% · vs Venom 41% · Skulls vs Flex 51% · vs Strikers 40% · vs Venom 38% · Flex vs Strikers 47% · vs Venom 49% · Strikers vs Venom 57%. Median 5 rounds, 90th pct 8.

**Findings**
- Best state so far: every die 44–56%, most matchups 36–64%.
- Tavern Swap is the biggest single improvement to matchups (avg. distance from 50% 18 → 12 points).
- Free Envenom overshoots (Viper 62%); kept at 1 Gold. Envenom still rarely used (0.17/game).
- Remaining outlier: Defense loses to Flex ~85% — Defense has too little ⚔ to get through healing.
- Basic Die (44%) is a fair "plain common".

## Run 6 — poison package v2 (2026-10-06)
Base: v0.4.1 + Risk (☠ on Guardian/Knight/Oracle) + Cond (Stand Fast only when Guardian shows 🛡; Counterattack needs ≥2 ⚔ blocked) + ⚡ (Archer, Dragon, Berserker one face each).
Changes from Run 5: leftover ☣ becomes ⚔ · Viper redesigned [⚔☣][⚔☣][☣][⚔][💰][☠] with **Envenom** (once per round, 1 Gold: one opponent die showing ♥ heals nothing this round; Wardable) · ☠ removed from Assassin (→⚔), Undead (→⚔), Dragon (→💰); Goblin and Berserker keep theirs (Sneaky and Bloodlust need ☠) · Antidote dropped.
Note: with "strip one 🛡 symbol + leftover becomes ⚔", ☣ deals exactly the same damage as ⚔ (only difference: it isn't "blocked", so it doesn't trigger Counterattack). So two versions were tested:
- **A (symbol):** each ☣ removes one 🛡 symbol; leftover ☣ → ⚔.
- **B (die):** each ☣ poisons one opponent die showing 🛡 and cancels all its shields (it no longer "shows 🛡", so it can't trigger Stand Fast/Counterattack/Formation); leftover ☣ → ⚔.
5,000 field games + 400 per matchup.

| | v0.4 | Run 5 pkg | A | B |
|---|---|---|---|---|
| Knight | 66% | 53% | 51% | 50% |
| Guardian | 64% | 56% | 54% | 50% |
| Elemental | 60% | 63% | 65% | 64% |
| Oracle | 62% | 63% | 60% | 60% |
| Dragon | 49% | 52% | 59% | 59% |
| Viper | — | 39% | 46% | 50% |
| Undead / Goblin | 38 / 39% | 42 / 42% | 47 / 43% | 49 / 44% |
| Defense vs GoldAggro | 100% | 94% | 90% | 87% |
| Defense vs Strikers | 98% | 91% | 88% | 84% |
| Defense vs Skulls | 100% | 94% | 94% | 93% |
| Defense vs Venom | — | 100% | 97% | **77%** |
| Defense vs Flex | 18% | 7% | 7% | 7% |
| Venom vs GoldAggro | — | 34% | 64% | 68% |
| Venom vs Flex | — | 11% | 32% | 44% |
Field spread: B 42%–64%. Envenom used 0.14×/game.

**Findings**
- **B is the better version**: Knight, Guardian and Viper all land at 50%, and the poison loadout is now competitive (beats GoldAggro/Skulls, close to Flex, and wins 23% vs Defense instead of 0–3%).
- Defense still beats loadouts that bring no ☣ 84–93% — it becomes a counter-pick game (bring poison against shields).
- Defense still loses to Flex ~93%.
- **Dragon overshot** to 59% (lost its ☠ and gained ⚡) — restore its ☠.
- **Elemental (64%)** and **Oracle (60%)** are now the top dice.

## Run 5 — shield-stripping poison package (2026-10-06, not adopted)
Designer direction: no piercing; lean on ☣ that strips shields, plus a ⚔-like ⚡ limited to one face per die.
Package base: v0.4.1 + **Risk** (☠ on Guardian/Knight/Oracle, see Run 4) + **Cond** (Stand Fast only when Guardian shows 🛡; Counterattack needs ≥2 ⚔ blocked).
- **☣ Corrode:** each ☣ removes one opponent 🛡 this round. On Assassin [💰]→[☣], Goblin one [☠]→[☣], Undead one [☠]→[☣], plus new **Viper's Die** [⚔][⚔][☣][☣][⚔☣][☠] (no ability).
- **⚡ Lightning:** 1 unblockable damage; one face per die. Archer [⚔]→[⚡], Dragon [⚔]→[⚡], Berserker [⚔]→[⚡].
- **Antidote (optional):** each ♥ may cancel one opposing ☣ instead of healing.
4,000 field games (25 dice) + 400 per matchup. Venom loadout = Viper, Assassin, Goblin, Undead, Archer.

| | v0.4 | Risk+Cond+☣ | + ⚡ | + ⚡ + Antidote |
|---|---|---|---|---|
| Knight | 66% | 53% | 53% | 53% |
| Guardian | 64% | 56% | 56% | 56% |
| Oracle | 62% | 62% | 63% | 64% |
| Elemental | 60% | 63% | 63% | 63% |
| Goblin | 39% | 43% | 42% | 42% |
| Undead | 38% | 42% | 42% | 42% |
| Viper (new) | — | 38% | 39% | 39% |
| Defense vs GoldAggro | 100% | 97% | 94% | 94% |
| Defense vs Skulls | 100% | 94% | 94% | 95% |
| Defense vs Strikers | 98% | 91% | 91% | 91% |
| Defense vs Venom | — | 100% | 100% | 100% |
| Defense vs Flex | 18% | 7% | 7% | 7% |

**Findings**
- The field is healthier (Knight/Guardian down to mid-50s, Goblin/Undead up), but the Defense loadout still beats aggressive loadouts 91–97% — the package is much weaker than Pierce2 (Defense vs Strikers 61%).
- Viper's Die is the weakest die and the Venom loadout loses to everything: ☣ does nothing against loadouts without shields, Viper has little damage, and the poison dice still carry ☠.
- ⚡ on three faces and Antidote have almost no measurable effect (Antidote rarely matters because ☣ is scarce).
- Remaining Defense edges: Counterattack still fires most rounds, Cleric healing, and the attackers' ☠ self-damage.

## Run 4 — anti-defense options on top of v0.4.1 (2026-10-06, not adopted)
4,000 field games + 400–600 per matchup each. Options:
- **Pierce3:** [⚔⚔⚔] faces unblockable (only Monster has one). **Pierce2:** [⚔⚔] and [⚔⚔⚔] unblockable.
- **Risk:** a ☠ added to the top defensive dice — Guardian [🛡][🛡][🛡][🛡🛡][⚔][☠], Knight [⚔][🛡][🛡][☠][🛡🛡][⚔🛡], Oracle [🛡][☠][💰][💰][⚔][♥].
- **Cond:** Stand Fast only when Guardian shows 🛡; Counterattack only if ≥2 opponent ⚔ blocked.
- **All_P2** = Pierce2 + Risk + Cond.
- **Poison ☣** (designer idea) on Assassin [💰]→[☣], Goblin one [☠]→[☣], Undead one [☠]→[☣]. Two versions: **Dot** = each ☣ gives opponent a token (max 3); each token deals 1 unblockable damage per round; each ♥ removes a token before healing. **Corrode** = each ☣ removes one opponent 🛡 this round.

| | v0.4 | Pierce3 | Pierce2 | Risk | Cond | All_P3 | All_P2 | Dot | Corrode | Corrode+All_P2 | Dot+All_P2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Knight | 66% | 65% | 60% | 59% | 60% | 53% | 49% | 63% | 64% | 47% | 45% |
| Guardian | 64% | 65% | 60% | 61% | 63% | 55% | 52% | 63% | 65% | 53% | 51% |
| Oracle | 62% | 63% | 63% | 60% | 64% | 63% | 62% | 61% | 62% | 61% | 61% |
| Goblin | 39% | 39% | 39% | 39% | 39% | 39% | 41% | 46% | 42% | 46% | 48% |
| Undead | 38% | 39% | 42% | 39% | 39% | 39% | 40% | 46% | 42% | 43% | 49% |
| Defense vs GoldAggro | 100% | 100% | 99% | 98% | 100% | 95% | 87% | 100% | 100% | 91% | 84% |
| Defense vs Skulls | 100% | 99% | 86% | 99% | 100% | 92% | 59% | 100% | 100% | 52% | 44% |
| Defense vs Strikers | 98% | 97% | 81% | 91% | 98% | 89% | 61% | 97% | 97% | 65% | 60% |
| Defense vs Flex | 18% | 15% | 15% | 16% | 7% | 7% | 7% | 16% | 16% | 8% | 8% |

**Findings**
- No single change is enough; **All_P2 (Pierce2 + Risk + Cond)** is the first package that makes Defense beatable (Knight 66→49%, Guardian 64→52%).
- Pierce on [⚔⚔⚔] only does almost nothing (only Monster has that face).
- Poison as tested (only 3 ☣ faces in the whole set) has little effect on Defense, but it lifts Goblin and Undead by 4–11 points. Dot version is stronger than Corrode. A dedicated poison die with 2–3 ☣ faces is needed to judge it fairly.
- Defense is now polarized: it still beats GoldAggro ~85–90% but loses to the healing/Flex loadout ~92%.
- Oracle (62%) and Elemental (~63%) are unaffected by these changes and become the top dice under All_P2.

## Run 3 — face tweaks on top of v0.4 (2026-10-06, not adopted)
- **A:** Knight → [⚔][⚔][🛡][🛡][🛡🛡][⚔🛡]; Guardian → [🛡][🛡][🛡][🛡🛡][⚔][⚔]
- **B:** one ☠ removed: Mage ☠→⚔, Dragon ☠→💰, Assassin ☠→⚔
- 6,000 field games + 600 per matchup for each of A, B, A+B.

| | v0.4 | A | B | A+B |
|---|---|---|---|---|
| Knight | 65.7% | 62.1% | 65.6% | 61.9% |
| Guardian | 64.0% | 64.6% | 64.2% | 64.3% |
| Dragon | 48.7% | 48.6% | 55.3% | 55.4% |
| Mage | 46.6% | 46.3% | 49.1% | 49.4% |
| Assassin | 44.7% | 45.4% | 47.8% | 48.9% |
| Defense vs GoldAggro | 100% | 100% | 100% | 100% |
| Defense vs Strikers | 98% | 97% | 98% | 95% |
| GoldAggro vs Flex | 45% | 45% | 61% | 61% |

**Conclusion:** neither fixes the shield wall. Expected symbols per round: Defense loadout 3.3 🛡 (+Formation, +Stand Fast), 1.0 ♥, 0 ☠; GoldAggro 3.0 ⚔ and 1.2 ☠; Strikers 4.3 ⚔ and 1.0 ☠. Shields cancel ⚔ 1:1 and the defensive dice carry no ☠, so aggressive loadouts can't out-damage the wall and lose ~1 Resolve/round to their own skulls. This needs a rule-level fix, not face tweaks.

## Run 2 — rules v0.4 (2026-10-06)
Changes tested: Resolve cap 10 · Wild Shape/Inspiration cost 1 Gold · double KO → higher Resolve wins · Goblin Sneaky pushes ☠ to opponent for 1 Gold.
Also tested Wild Shape/Inspiration as once-per-match instead of 1 Gold: nearly identical results (Druid 54% vs 53%), so the 1-Gold version was kept — it adds a Gold decision every round.

**12,000 random-loadout games:** median 5 rounds, 90th pct 9, max 12. Double KO 18% of games, but only **3% now go to a roll-off** (was 15%).
Per player per game: 7.5 ⚔ damage, 0.85 Counterattack, 2.5 self ☠, 4.7 healing (was 5.4).

| Die | v0.3.1 | v0.4 |
|---|---|---|
| Knight | 60.1% | **65.7%** |
| Guardian | 61.7% | 64.0% |
| Oracle | 57.9% | 61.9% |
| Elemental | 58.0% | 60.3% |
| Cleric | 54.5% | 54.9% |
| Alchemist | 54.3% | 54.5% |
| Bard | 62.3% | 53.2% |
| Druid | **70.4%** | 53.1% |
| Warlock | 50.8% | 51.8% |
| Paladin | 49.4% | 50.2% |
| Dragon | 48.3% | 48.7% |
| Soldier | 47.1% | 48.7% |
| Mimic | 49.2% | 48.1% |
| Archer | 47.0% | 47.4% |
| Gambler | 43.1% | 47.3% |
| Mage | 46.0% | 46.6% |
| Fey | 44.9% | 45.7% |
| Thief | 44.9% | 45.3% |
| Assassin | 43.7% | 44.7% |
| Dwarven | 43.7% | 44.4% |
| Monster | 44.3% | 44.1% |
| Berserker | 44.7% | 42.5% |
| Goblin | 37.8% | 39.5% |
| Undead | 36.7% | 37.7% |

**Archetype matchups (600 games each):**
| Matchup | v0.3.1 | v0.4 | median rounds |
|---|---|---|---|
| Defense vs GoldAggro | 100% | 100% | 5 |
| Defense vs Skulls | 100% | 100% | 6 |
| Defense vs Flex | 0% | 18% | 10 |
| Defense vs Strikers | 98% | 98% | 4 |
| GoldAggro vs Skulls | 56% | 50% | 2 |
| GoldAggro vs Flex | 1% | 45% | 4 |
| GoldAggro vs Strikers | 27% | 24% | 2 |
| Skulls vs Flex | 0% | 32% | 6 |
| Skulls vs Strikers | 29% | 30% | 2 |
| Flex vs Strikers | 92% | 41% | 4 |
(Defense = Soldier, Guardian, Knight, Cleric, Oracle · GoldAggro = Gambler, Dragon, Mage, Assassin, Berserker · Skulls = Berserker, Monster, Goblin, Warlock, Cleric · Flex = Druid, Bard, Alchemist, Fey, Mimic · Strikers = Archer, Assassin, Mage, Elemental, Monster)

### Findings
1. Fixed: Druid/Bard are now mid-pack; the healing loadout is no longer unbeatable; roll-offs dropped from 15% to 3%.
2. **Still broken: shield-heavy defense.** Knight, Guardian and Oracle are the top three dice, and the Defense loadout still beats every aggressive loadout ~98–100%. Aggressive loadouts lose ~1 Resolve per round to their own ☠ while the shield wall blocks nearly all ⚔.
3. **Aggro mirrors are very fast** (median 2 rounds) — skull-heavy dice hurt both sides.
4. Goblin's new Sneaky is used rarely (0.15/game) and Goblin is still weak; Undead remains the weakest die.

## Run 1 — rules v0.3.1 (uncapped healing)
Druid 70%, Bard 62%; healing/flex loadout beat everything 92–100%; 15% of games went to sudden death; Knight 60% → 46% without Counterattack. Old Goblin Sneaky had no effect (duplicated universal Reroll).
