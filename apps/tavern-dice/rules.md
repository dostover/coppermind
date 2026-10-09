# Tavern Dice — Working Rules (Prototype v0.10.4)

PvP collectible-dice game played inside a D&D campaign. Inspired by Dice Hunter: Dicemancer Quest, minus the monster battles. **The dice create the possibilities. Gold creates the decisions. The opponent creates the uncertainty. The tavern creates the atmosphere.**

## Changelog
- **v0.10.4 (2026-10-09, designer-approved):** Wild Shape (Druid) and Inspiration (Bard) now cost **2 Gold** (was 1). Druid and Bard get their original faces back (the v0.10.3 face changes are undone). Druid 52.8%, Bard 54.5% — both inside the Rare range. (Sim Run 20.)
- **v0.10.3 (2026-10-08, designer-approved):** Balance pass on the eight dice the simulator kept flagging, one or two face changes each, abilities unchanged. Nerfs: Druid [💰]→[☠] (64%→58%; undone in v0.10.4), Paladin [⚔🛡]→[⚔] (61%→52%), Bard [💰⚔]→[💰] and [🛡♥]→[♥] (61%→57%; undone in v0.10.4), Assassin one [⚔]→[☠] (60%→~49%), Elemental one [⚔]→[💰] (60%→56%). Buffs: Mimic [☠]→[⚔] (42%→51%), Mage [☠]→[💰] (43%→51%), Taxman [☠]→[🛡] (43%→52%). (Sim Run 19.)
- **v0.10.2 (2026-10-08, designer-approved):** Closing Time now starts on **turn 10** (was 8). With Mend in place this keeps balance unchanged: rounds average 6.6 turns, the clock reaches about 1 round in 5 and decides about 1 in 9. (Sim Run 18.)
- **v0.10.1 (2026-10-08, designer-requested):** Barkeep's Last Orders now starts on turn 5 (no longer tied to Closing Time). Barkeep 46% → 50%. (Sim Run 18.)
- **v0.10 (2026-10-07, designer-approved):** Healing and the round clock reworked so the dice, not the clock, decide rounds. **Last Call → Closing Time:** from turn 8, each player loses a flat 1 Resolve per turn (no escalation, no "no healing" rule). **♥ → Mend:** each ♥ restores 1 Resolve lost this turn, never above where you started the turn; Closing Time's damage can't be mended. Dice updated: Sawbones' Triage now mends Closing Time; Barkeep's Last Orders triggers from turn 8; Cook and Guardian text updated. (Sim Run 16: rounds 5.5 → 6.2 turns, the clock decides 14% of rounds instead of 23%, no stalls, tier balance unchanged.)
- **v0.9.1 (2026-10-07, designer-requested):** Expansion 3 "Tavern Regulars" — twelve Common dice, each with one simple automatic ability (Bouncer, Cook, Minstrel, Brewer, Drunkard, Watchman, Smith, Cardsharp, Ratcatcher, Fisher, Militia, Herbalist). Collection is now 52 dice (5 Basic, 23 Common, 14 Uncommon, 10 Rare). Seven were trimmed or boosted by one face after the first sim pass. (Sim Run 14.)
- **v0.9 (2026-10-07, designer-approved):** Influence split into two steps. **Fortune:** Reroll, Focus, Mulligan, Distract (and Omen's free reroll). **Tactics:** activated abilities and Jam. Each step alternates one action at a time, active player first, and ends after two passes in a row. Ward still answers any targeting action in either step. (Sim Run 13: roughly balance-neutral.)
- **v0.8.4 (2026-10-06, designer-approved):** Influence clarified: an action that targets the other player or one of their dice (Distract, Jam, Envenom, Sneaky) is **declared** first; its cost is paid, then the targeted player may **Ward** (1 Gold) to cancel it or allow it. Priority then passes. Ward's timing is now explicit.
- **v0.8.3 (2026-10-06, designer-approved):** All ability text rewritten in one pattern — condition, then effect, then exception. Rules unchanged, with two clarifications that match how the roller and simulator already work: Divine Protection is once per turn; Relentless resets each round.
- **v0.8.2 (2026-10-06, playtest):** Expansion 2 "Coin & Cure" — seven Gold and healing dice (Pilgrim, Barkeep, Moneylender, Taxman, Sawbones, Puppeteer, Hydra). Collection is now 40 dice.
- **v0.8.1 (2026-10-06, playtest):** Expansion 1 — seven new dice built from the rarity template (Brawler, Shieldbearer, Peddler, Stormcaller, Apothecary, Tempest, Plaguebringer). Collection is now 33 dice.
- **v0.8 (2026-10-06, designer-approved):** Added rarity tiers (Basic, Common, Uncommon, Rare). Existing dice are sorted into tiers unchanged; the tiers set the pattern for designing new dice. Added tournament formats (Open, League Night point budget, Commoner's Cup).
- **v0.7 (2026-10-06, designer-approved):** Healing stops during Last Call (from turn 6 of a round, ♥ restores nothing). Tavern Swap allows up to 2 dice before rounds 2 and 3. (Sim Run 10: average themed matchup 5.7 points from 50/50; Defense vs healing loadout 1% → 49%.)
- **v0.6 (2026-10-06, designer-approved):** New turn order. Matches are best of 3 rounds; a round is played to 0 Resolve in turns. Each turn has three phases — Roll, Influence, Resolution — and an active player (random at the start, switching every turn; the loser of a round starts the next round active) who has priority in each phase. Influence alternates one action at a time, active player first. Resolution stays simultaneous; the active player wins double KOs (replaces the higher-Resolve tiebreak and roll-off). Resolve and Gold reset each round. Tavern Swap moves to before rounds 2 and 3. Ability timing words changed from "round" to "turn".
- **v0.5.1 (2026-10-06, designer-approved):** Added **Tavern Swap**. Balance pass: Elemental [⚔⚔]→[⚔]; Monster one [☠]→[⚔]; Berserker one [⚔]→[⚔⚔]; Gambler [☠☠]→[☠]; Omen's free Reroll now only for the Oracle die itself. Envenom stays at 1 Gold (free Envenom pushed Viper to 62%). (Sim Run 7.)
- **v0.5 (2026-10-06, designer-approved):** Anti-shield package. New symbols ☣ Poison (cancels a whole shield die; leftover becomes ⚔) and ⚡ Lightning (unblockable, max one face per die). ☠ added to Guardian, Knight and Oracle. Stand Fast only when Guardian shows 🛡; Counterattack needs 2+ ⚔ blocked. ☣ added to Assassin, Goblin, Undead; ☠ removed from Assassin and Undead. ⚡ added to Archer, Dragon, Berserker. New dice: Viper's Die and Basic Die. Starter collection is now 26 dice. (Sim Run 6.)
- **v0.4.1 (2026-10-06, designer-approved):** No duplicate dice in a loadout.
- **v0.4 (2026-10-06, designer-approved):** Resolve capped at 10. Wild Shape and Inspiration now cost 1 Gold (still once per round). Double KO: higher Resolve wins, roll-off only on a tie. Goblin's Sneaky redesigned (old version duplicated the universal Reroll). Driven by simulator results (see sim-results.md).
- **v0.3.1 (2026-10-06, designer-approved):** Reworded Bloodlust, Backstab and Counterattack. Bloodlust counts only ☠ that actually deal damage. Counterattack damage is unblockable.
- **v0.3 (2026-10-06, designer-approved):** Last Call ignores all reductions. Approved all of Claude's v0.2 proposals: new faces for all dice, new Gambler/Cleric/Mage/Warlock abilities, Monster's Die has no ability, Oracle's Die gains Omen, sudden-death roll-off procedure.
- **v0.2.2 (2026-10-06, designer-approved):** Added **Last Call** anti-stall rule.
- **v0.2.1 (2026-10-06, designer-approved):** 🛡 cannot block ☠. Healing is uncapped. Simultaneous 0 Resolve → sudden-death roll-off. Starting Resolve stays 10 (20 considered and rejected in favor of Last Call).
- **v0.2 (2026-10-06, designer-approved):** Removed ✦ Charge and ↻ Reroll symbols. ☠ deals 1 damage to the roller per ☠. Faces may carry multiple symbols, each worth 1. Simultaneous rolling, loose action order. No starting Gold. Paladin's Die fixed to 6 faces. Oracle's Foresee removed. Elemental's Volatile: both rolls resolve. Mimic may copy once-per-round abilities (Wild Shape, Trickster) as a second use.

## Foundations (provisional — under playtest)
- **Terms:** a **match** is best of 3 **rounds**. A round is played until one player reaches 0 Resolve. A round is made of **turns**, and each turn has three phases.
- **Loadout:** each match a player picks **5 dice** from their collection. **No duplicates.** The collection persists between matches.
- **Resolve** = health within a round. Start each round at **10**; **maximum 10**. Reach 0 and you lose the round.
- **Gold** = temporary tactical resource (like 40k Command Points). **Starts at 0 each round** and is lost when the round ends. Not treasure, not campaign currency, not used to buy dice, not victory points.
- **Winning the match:** first player to win 2 rounds. Round 3 is only played at 1–1.
- **Tavern Swap:** before round 2 and before round 3, each player may swap **up to 2 dice** in their loadout for other dice from their collection. No-duplicates still applies.

## Active player
- Randomly choose the **active player** for the first turn of round 1. The active player switches every turn.
- The player who **lost** the previous round is the active player on the first turn of the next round.
- The active player has **priority** in every phase: they act first, and they win ties (see Resolution).

## Turn structure
1. **Roll** — the active player rolls all 5 of their dice, then the other player rolls theirs.
2. **Influence** — two steps. In each step players act **one action at a time, starting with the active player**, then alternating; a player may pass, and the step ends when both players pass in a row.
   - **Fortune (settle the dice):** Reroll, Focus, Mulligan, Distract, and Oracle's Omen reroll.
   - **Tactics (use the dice):** activated die abilities (Wild Shape, Envenom, Arcane Surge, Strings, …) and Jam.
   - An action that **targets the other player or one of their dice** (Distract, Jam, Envenom, Sneaky) is **declared** first: pay its cost, then the targeted player chooses to **Ward** it (1 Gold, cancelled) or **allow** it. Then priority passes.
3. **Resolution** — everything resolves **simultaneously**:
   - ☣ — **Poison:** before blocking, each ☣ poisons one opponent die showing 🛡 (the ☣'s owner chooses; if both players need to choose, the active player chooses first). All shields on that die are cancelled, and it no longer counts as "showing 🛡" this turn (so it can't trigger Formation, Stand Fast or Counterattack). A ☣ with no shield die left to poison counts as a normal ⚔ instead.
   - ⚔ — each deals 1 damage to the opponent.
   - 🛡 — each blocks 1 of the opponent's ⚔ damage. 🛡 cannot block ☠ or ⚡.
   - ⚡ — each deals 1 damage to the opponent that 🛡 can't block.
   - ☠ — each deals 1 damage to you.
   - 💰 — each gains you 1 Gold.
   - ♥ — **Mend:** each ♥ restores 1 Resolve you lost this turn (from ⚔, ⚡, ☠, counterattacks, poison leftovers — anything except Closing Time). It never takes you above the Resolve you started the turn with; a ♥ with nothing to mend does nothing.
   - **Closing Time:** from turn 10 of a round onward, at the end of Resolution both players lose **1 Resolve** (every turn, it doesn't grow). Unblockable; ignores all reductions (Stand Fast, Divine Protection, etc.); can't be mended by ♥ (Sawbones' Triage is the exception); does not trigger Bloodlust.
   - **Round end:** a player at 0 or below loses the round. If **both** players are at 0 or below, **the active player wins the round**.

## Faces
Faces may carry multiple symbols, each worth 1 (e.g. [🛡🛡] = 2 Defense, [💰⚔] = 1 Gold + 1 Attack). Notation: each [ ] is one face.

## Universal Gold Abilities
| Ability | Cost | Effect |
|---|---|---|
| Reroll | 1 | *(Fortune)* Reroll one of your dice; keep new result. Repeatable if you can pay. |
| Mulligan | 2 | *(Fortune)* Reroll up to 3 of your dice; keep new results. |
| Focus | 2 | *(Fortune)* Roll one of your dice twice; choose which to keep. |
| Distract | 1 | *(Fortune)* Opponent must reroll one of their rolled dice and keep it. |
| Jam | 2 | *(Tactics)* One opponent die can't use its special ability this turn; its face still resolves. |
| Ward | 1 | *(Either step)* Reactive: when the other player declares an action that targets you or one of your dice, pay 1 Gold to cancel it before it takes effect. Their Gold stays spent. Doesn't stop effects that hit all players or all dice. |

Gold design principles: not just more damage; no universally optimal spend; balance offense/defense/probability; low bookkeeping; never invalidate a whole loadout; quick to understand; universal rather than die-specific. No new universal Gold abilities unless the designer asks.

## Symbols
⚔ Attack · 🛡 Defense · 💰 Gold · ♥ Mend (undo damage taken this turn) · ☠ Risk (1 self-damage, unblockable) · ☣ Poison (cancels a shield die, else ⚔) · ⚡ Lightning (unblockable damage)
**⚡ design limit:** at most one ⚡ face per die, with a single ⚡ on it.
*(✦ Charge and ↻ Reroll removed in v0.2.)*

## Dice design rule
Rarity ≠ bigger numbers. Rare dice offer interactions, specialized strategies, new tactics, more complexity/risk. Commons stay useful.

## Starter Collection (v0.5)
1. **Soldier's** *(Common)* — [⚔][⚔][🛡][🛡][⚔🛡][💰] — *Formation:* If this die shows 🛡, one other die of yours showing 🛡 gets +1 🛡. Reliable hybrid.
2. **Berserker's** *(Common)* — [⚔][⚔][⚔⚔][⚡][☠][🛡] — *Bloodlust:* If this die shows ⚔, it deals 1 extra damage for each ☠ that hits you this turn. A ☠ rerolled or cancelled before Resolution doesn't count. Comeback attacker.
3. **Guardian's** *(Common)* — [🛡][🛡][🛡][🛡🛡][⚔][☠] — *Stand Fast:* If this die shows 🛡, you lose 1 less Resolve this turn (including from ☠). Doesn't reduce Closing Time. Defensive anchor.
4. **Gambler's** *(Uncommon)* — [💰][💰][💰💰][💰💰💰][☠][☠] — *High Roller:* Once per turn, roll this die again. Both results count. Push-your-luck economy.
5. **Thief's** *(Common)* — [💰][💰][💰][💰⚔][⚔][☠] — *Pickpocket:* For each 💰 on this die, you may take 1 Gold from your opponent instead of gaining it. Resource disruption.
6. **Archer's** *(Common)* — [⚔][⚔][⚡][⚔⚔][🛡][💰] — *Precise Shot:* If this is the only one of your dice showing ⚔, it deals 1 extra damage. Focused damage.
7. **Cleric's** *(Uncommon)* — [🛡][🛡][♥][♥][♥♥][🛡♥] — *Blessing:* Give up one ♥ on this die to cancel one ☠ on another of your dice. Once per ♥. Healing/support.
8. **Mage's** *(Uncommon)* — [⚔][⚔][⚔⚔][⚔💰][💰][💰] — *Arcane Surge:* If this die shows ⚔, spend 1 Gold: its ⚔ can't be blocked this turn. Resource-hungry caster. Sim 51% (v0.10.3; was [⚔][⚔][⚔⚔][⚔💰][💰][☠]).
9. **Druid's** *(Rare)* — [⚔][🛡][♥][🛡♥][⚔🛡][💰] — *Wild Shape:* Once per turn, spend 2 Gold to turn this die to any of its faces. Flexible. Sim 53% (v0.10.4: cost 1 → 2 Gold; original faces).
10. **Bard's** *(Rare)* — [⚔][🛡][♥][💰][💰⚔][🛡♥] — *Inspiration:* Once per turn, spend 2 Gold to set this die to the same result as another of your dice. Adaptive support. Sim 55% (v0.10.4: cost 1 → 2 Gold; original faces).
11. **Assassin's** *(Common)* — [⚔][⚔][⚔][⚔⚔][☣][☠] — *Backstab:* If none of your opponent's dice show 🛡 when results lock, this die deals 1 extra damage. Poisoned shields don't count. Anti-defense. Sim ~49% (v0.10.3; was [⚔][⚔][⚔][⚔⚔][☣][⚔]).
12. **Paladin's** *(Uncommon)* — [⚔][🛡][🛡][🛡♥][♥][⚔] — *Divine Protection:* Once per turn, if this die shows 🛡, spend 1 Gold to block 1 more damage. Gold-powered defense. Sim 52% (v0.10.3; was [⚔][🛡][🛡][🛡♥][♥][⚔🛡]).
13. **Dragon's** *(Uncommon)* — [⚔][⚡][⚔⚔][💰][💰][☠] — *Hoard:* Each time this die gives you Gold, gain 1 more. Gold engine.
14. **Fey** *(Rare)* — [⚔][🛡][♥][💰][⚔🛡][☠] — *Trickster:* Once per turn, swap the results of two of your dice. Manipulation.
15. **Dwarven** *(Common)* — [⚔][⚔][🛡][🛡][🛡🛡][💰] — *Stubborn:* Your opponent can't Distract this die. Anti-control.
16. **Goblin** *(Uncommon)* — [⚔][💰][💰][💰💰][☣][☠] — *Sneaky:* If this die shows ☠, spend 1 Gold: your opponent takes that ☠'s damage instead of you. They may Ward it. Chaotic economy.
17. **Undead** *(Uncommon)* — [☣][⚔][⚔][⚔⚔][🛡][♥] — *Relentless:* The first time this die is Jammed each round, ignore the Jam. Disruption-resistant.
18. **Elemental** *(Rare)* — [⚔][⚔][💰][🛡][💰][☠] — *Volatile:* At Resolution, roll this die again; the new result also counts. If it matches the first result, deal 1 extra damage that can't be blocked. Repeat-roll engine. Sim 56% (v0.10.3; was [⚔][⚔][⚔][🛡][💰][☠]).
19. **Knight's** *(Common)* — [⚔][🛡][🛡][☠][🛡🛡][⚔🛡] — *Counterattack:* If this die shows 🛡 and your shields block 2 or more ⚔ this turn, your opponent takes 1 damage. Shields can't block it. Defensive retaliation.
20. **Warlock's** *(Rare)* — [⚔][⚔⚔][☠][☠][💰][💰💰] — *Dark Bargain:* Lose 1 Resolve to turn this die to any of its faces. You can do this more than once. Health for consistency.
21. **Alchemist's** *(Uncommon)* — [💰][💰][♥][♥♥][💰♥][☠] — *Transmutation:* Spend 1 Gold to turn this die to any of its faces. You can do this more than once. Flexible economy.
22. **Monster's** *(Common)* — [⚔⚔][⚔⚔][⚔⚔⚔][⚔][☠][☠] — *No ability.* Big ⚔ faces are the payoff for its ☠. Extreme offense, built-in risk.
23. **Oracle's** *(Uncommon)* — [🛡][☠][💰][💰][⚔][♥] — *Omen:* Once per turn, you may Reroll this die for free. Probability control.
24. **Mimic** *(Rare)* — [⚔][🛡][💰][♥][⚔🛡][⚔] — *Imitate:* At the start of each turn, choose another die in your loadout. Until the turn ends, this die has that die's ability (once-per-turn abilities can be used again). Combo piece. Sim 51% (v0.10.3; was [⚔][🛡][💰][♥][⚔🛡][☠]).

25. **Viper's** *(Uncommon)* — [⚔☣][⚔☣][☣][⚔][💰][☠] — *Envenom:* Once per turn, spend 1 Gold: one of your opponent's dice showing ♥ heals nothing this turn. They may Ward it. Anti-defense / anti-healing.
26. **Basic Die** *(Basic)* — [🛡][🛡][⚔][⚔][💰][💰] — *No ability.* The plain common die everyone starts with.

## Expansion 1 (playtest — built from the rarity template)
27. **Brawler's** *(Basic)* — [⚔][⚔][⚔][🛡][💰][ ] — *No ability.* Starter offense. Sim 42%.
28. **Shieldbearer's** *(Basic)* — [🛡][🛡][🛡][⚔][💰][ ] — *No ability.* Starter defense. Sim 46%.
29. **Peddler's** *(Basic)* — [💰][💰][⚔][🛡][♥][ ] — *No ability.* Starter economy. Sim 42%.
30. **Stormcaller's** *(Common)* — [⚔][⚡][🛡][💰][⚔][⚔] — *Arc:* If this die shows ⚡ and your opponent shows 2 or more 🛡, it deals 1 extra ⚡ damage. Punishes shield walls. Sim 48%.
31. **Apothecary's** *(Uncommon)* — [☣][☣][⚔☣][♥][💰][☠] — *Toxin Coat:* Once per turn, spend 1 Gold: another of your dice showing ⚔ also gains a ☣ this turn. Spreads poison. Sim 54% (top of range — watch).
32. **Tempest** *(Rare)* — [⚡][⚔⚔][⚔⚔][🛡][💰][☠] — *Chain Lightning:* If this die shows ⚡, up to two of your other dice showing ⚔ each change one ⚔ into ⚡ this turn. Build-around for attack loadouts. Sim 52%.
33. **Plaguebringer** *(Rare)* — [☣][☣☣][⚔☣][🛡][♥][☠] — *Epidemic:* If this die shows ☣, each ☣ on your other dice counts as two. Build-around for poison loadouts. Sim 55%.
(Sim: 2,000 random Open matches, v0.7 rules; ±4% margin per die. Tier averages with the expansion: Basic 44%, Common 50%, Uncommon 50%, Rare 53%.)
Note: Tempest's Chain Lightning can put more than one ⚡ in play — an intended exception to the "one ⚡ face per die" design limit, since it converts existing ⚔ rather than adding faces.

## Expansion 2 "Coin & Cure" (playtest — built from the rarity template)
34. **Pilgrim's** *(Basic)* — [♥][♥][🛡][⚔][⚔][ ] — *No ability.* Starter healing. Sim 39%.
35. **Barkeep's** *(Common)* — [💰][💰][♥][🛡][⚔][💰] — *Last Orders:* From turn 5, each 💰 on this die also counts as a ⚔. You still gain the Gold. Late-round closer. Sim 50% (v0.10.1; was turn 8 → 46%).
36. **Moneylender's** *(Uncommon)* — [💰][💰💰][⚔][🛡][⚔💰][☠] — *Loan:* Once per turn, gain 2 Gold and lose 1 Resolve. Health for Gold now. Sim 50%.
37. **Taxman's** *(Uncommon)* — [💰][⚔][🛡][💰][⚔💰][🛡] — *Levy:* At Resolution, if your opponent has more Gold than you, take 1 Gold from them. Punishes hoarding. Sim 52% (v0.10.3; was [💰][⚔][🛡][💰][⚔💰][☠]).
38. **Sawbones'** *(Uncommon)* — [♥][♥♥][🛡🛡][⚔][⚔♥][☠] — *Triage:* This die's ♥ can also mend Closing Time's 1 damage. The one healer that beats the clock. (v0.10; was "still heals during Last Call".)
39. **Puppeteer** *(Rare)* — [💰][⚔][🛡][♥][⚔🛡][⚔⚔] — *Strings:* Once per turn, spend 2 Gold to turn one of your other dice to any of its faces. Flexible control. Sim 56%.
40. **Hydra** *(Rare)* — [⚔][⚔⚔][⚔⚔][🛡][♥][☠] — *Regrow:* If this die shows ☠, it also counts as ⚔⚔. You still take the ☠ damage. Risk becomes reward. Sim 56%.
(Sim: 2,400 random Open matches with all 40 dice, v0.7 rules; Pilgrim and Sawbones re-tested after tuning in 800 targeted matches. ±4% margin.)
Watch: with 40 dice in the pool, the whole Basic tier now sits at ~39–42% (below the 42–46% target set when there were 26 dice). Consider re-centering the Basic target to 38–44%.

## Expansion 3 "Tavern Regulars" (all Common — built from the rarity template)
Tavern folk with one simple automatic ability each: no Gold costs, no choices. Sim = Open-format win rate (±4%).

41. **Bouncer** *(Common)* — [🛡][🛡][⚔][🛡][⚔][💰] — *Doorman:* If this die shows 🛡 and your opponent shows 3 or more ⚔, it gets +1 🛡. Anti-swarm defense. Sim 47%.
42. **Cook** *(Common)* — [♥][♥][🛡][⚔][💰][🛡♥] — *Hearty Stew:* If this die shows ♥ and you have 5 or less Resolve, it heals 1 more. Comeback healing. Sim 49%.
43. **Minstrel** *(Common)* — [♥][💰][⚔][🛡][💰][⚔] — *Rousing Tune:* If this die shows ♥, one other die of yours showing ⚔ gets +1 ⚔. Support. Sim 52%.
44. **Brewer** *(Common)* — [💰][💰][♥][🛡][⚔][💰] — *Strong Brew:* If this die shows ♥, you also gain 1 Gold. Gold and healing. Sim 47%.
45. **Drunkard** *(Common)* — [⚔⚔][⚔][⚔][☠][🛡][⚔] — *Liquid Courage:* If this die shows ⚔ and you have 5 or less Resolve, it deals 1 extra damage. Desperate offense. Sim 51%.
46. **Watchman** *(Common)* — [🛡][🛡][⚔][⚔][⚔🛡][💰] — *Night Watch:* ☣ can't poison this die. Anti-poison defense. Sim 49%.
47. **Smith** *(Common)* — [⚔][⚔][🛡][⚔][💰][🛡] — *Sunder:* If this die shows ⚔ and your opponent shows 2 or more 🛡, it gets +1 ⚔. Shields can still block it. Shield breaker. Sim 49%.
48. **Cardsharp** *(Common)* — [💰][💰][⚔][🛡][⚔💰][♥] — *Lucky Streak:* If 3 or more of your dice show 💰, gain 1 more Gold. Gold engine. Sim 48%.
49. **Ratcatcher** *(Common)* — [⚔][⚔][☣][🛡][💰][⚔] — *Pest Control:* If this die shows ⚔ and your opponent shows ☠, it deals 1 extra damage. Punishes risky dice. Sim 47%.
50. **Fisher** *(Common)* — [💰][💰][♥][🛡][⚔][🛡♥] — *Patient:* If you have less Gold than your opponent, each 💰 on this die gives 1 more Gold. Catch-up economy. Sim 52%.
51. **Militia** *(Common)* — [⚔][🛡][⚔][🛡][⚔][♥] — *Rally:* If this die shows ⚔ and you have less Resolve than your opponent, it deals 1 extra damage. Comeback hybrid. Sim 51%.
52. **Herbalist** *(Common)* — [♥][♥][☣][🛡][⚔][💰] — *Antidote:* If this die shows ♥, cancel one of your opponent's ☣. It poisons nothing and doesn't count as ⚔. Anti-poison healer. Sim 48%.

## Rarity
Rarity adds **moderate power and more complexity**. A Rare should beat a Common a little more often, mostly through a stronger or more flexible ability, not just bigger numbers. Commons stay playable.

| Tier | Existing dice | Sim win rate (v0.7) |
|---|---|---|
| Basic | Basic | 47% |
| Common | Soldier, Guardian, Archer, Dwarven, Assassin, Berserker, Knight, Thief, Monster | 49% avg |
| Uncommon | Cleric, Mage, Paladin, Dragon, Goblin, Gambler, Alchemist, Undead, Viper, Oracle | 50% avg |
| Rare | Druid, Bard, Fey, Mimic, Warlock, Elemental | 53% avg |

### Template for new dice
| | Basic | Common | Uncommon | Rare |
|---|---|---|---|---|
| **Face budget** (symbol value, see below) | 5 | 6–7 | 7–8 | 7–9 |
| **Blank faces** | 1 | 0 | 0 | 0 |
| **Double / triple faces** | none | at most 1 double | 1–2 doubles | doubles; one triple allowed |
| **☠ faces** | none | 0–1 | 0–2 | 0–2 (big risk allowed if the payoff is big) |
| **Ability** | none | one simple passive: "if X, +1" — no Gold, no choices | Gold- or Resolve-activated, or one choice, or ties into one system (Gold, poison, healing) | bends a rule: change or copy faces, swap, extra rolls, ignore a limit — or a build-around |
| **Target win rate in the simulator** | 42–46% | 45–50% | 48–53% | 51–56% |

**Symbol values** (for the face budget; approximate): ⚔ 🛡 💰 ♥ = 1 · ⚡ ≈ 1.5 (unblockable) · ☣ ≈ 1.25 · ☠ = −1 (each ☠ buys about one extra symbol elsewhere) · blank = 0.
**Ability values** (approximate): simple passive ≈ +1 symbol · Gold-activated ≈ +1–2 · rule-bending ≈ +2–3. Keep the total (faces + ability) inside the tier's range.
**Checklist for a new die:** pick the tier → spend the face budget → write one ability at the tier's complexity → give it one identity line → run it through the simulator and confirm its win rate lands in the tier's target range before printing.
Note: the existing Basic Die has no blank face; new Basic dice follow the template (one blank).

### Tournament formats
- **Open (Tavern Brawl):** bring any 5 dice you own. No limits.
- **League Night (point budget):** Basic 0 · Common 1 · Uncommon 2 · Rare 3 points; a loadout may spend at most **8**. Tavern Swaps must stay within the budget.
- **Commoner's Cup:** Basic and Common dice only — good for new players.

## Dice looks
Each die has its own material in the roller (useful if you buy or paint physical dice): **Alchemist** — Amber bubbles; **Archer** — Forest splotch; **Assassin** — Black opal (red speckle); **Bard** — Rose-gold swirl; **Basic** — Old bone; **Berserker** — Bloodstone swirl; **Cleric** — Pearl & gilt; **Dragon** — Ember scale; **Druid** — Moss & bark; **Dwarven** — Granite; **Elemental** — Fire & tide; **Fey** — Iridescent swirl; **Gambler** — Card-table jade (gold flecks); **Goblin** — Swamp splotch; **Guardian** — Cobalt & silver; **Knight** — Silver marble; **Mage** — Midnight stars; **Mimic** — Chest oak; **Monster** — Scaled hide; **Oracle** — Twilight marble; **Paladin** — Ivory gold-vein; **Soldier** — Gunmetal fleck; **Thief** — Smoke & plum; **Undead** — Grave-mold bone; **Viper** — Emerald venom; **Warlock** — Hexed violet. Expansion 3: **Bouncer** — Brass knuckles; **Brewer** — Hops & barley; **Cardsharp** — Felt & diamonds; **Cook** — Copper pot; **Drunkard** — Spilled wine; **Fisher** — River pebble; **Herbalist** — Sage & clay; **Militia** — Homespun wool; **Minstrel** — Lute spruce; **Ratcatcher** — Sewer slate; **Smith** — Forge iron; **Watchman** — Lantern night.

## Balance guidelines
Evaluate face distribution (useful-result rate, downside, dominant face, value when Jammed), ability strength (meaningful but not match-deciding), synergy (alone and in combos), and Gold interaction (generators, spenders, savers, punishers — no runaway economies).

## Match tracking
Track each player's 5 dice, Resolve, Gold, current results, temporary effects, used abilities, turn, round and match score, active player. Announce rolls, choices, Gold spent, ability activations, damage/healing, end-of-turn effects (incl. Closing Time), updated Resolve/Gold. Use genuine randomness; never fudge rolls.

## Design iteration
Rules are a prototype. Treat designer proposals as intentional; identify affected mechanics; flag balance/rules problems; update working rules on approval; never silently revert. Prefer small, testable changes.

## Open questions / watch list
- **v0.10.4 (Run 20):** Druid and Bard fixed by raising Wild Shape / Inspiration to 2 Gold (faces restored). Mimic copying them pays 2 too.
- **v0.10.2 (Run 18):** Closing Time moved to turn 10 — rounds avg 6.6 turns, 10% run 12+ turns (longest 19); clock decides 11% of rounds. Playtest whether rounds feel too long.
- **v0.10 (Runs 16–17):** Closing Time 8 + Mend. Rounds avg 6.2 turns, clock decides 15% of rounds; tiers 43/50/50/54%. Watch: healing vs Gold-aggro loadouts 63–71% (was 57%); Barkeep fixed in v0.10.1 (Last Orders from turn 5, 50%); outliers tuned in v0.10.3; the shield-wall loadout (Soldier/Guardian/Knight/Cleric/Paladin) loses almost every defensive mirror because it barely deals damage; new Triage tested fine (Sawbones 50%). Playtest whether a ♥ that "does nothing" on a quiet turn feels bad.
- **v0.9.1 sim (Run 14, 52 dice):** Expansion 3 tuned into the Common range (47–52%). With the bigger pool, Druid (63%), Paladin (57%), Assassin (56%) and Bard (58%) run hot, and Basic averages 42%. Minstrel and Fisher sit at the top of Common (52%) — watch. Two anti-poison Commons (Watchman, Herbalist) — watch whether ☣ still answers shield walls.
- **v0.9 sim (Run 13):** two-step Influence ≈ balance-neutral (dice 41–60%, median 11 turns/match). Gold-hungry attack dice lost ground (Mage 48%→42%, Gambler −6 pts); defensive dice gained a little. Distract use fell from 4.8 to 1.7 per match. Watch Mage. Sim result depends on players saving Gold for Tactics.
- **v0.7 sim (Run 10):** themed matchups all 41–67%, average 5.7 points from 50/50; dice 42–58%; median 13 turns per match. Bard (58%) and Elemental (57%) top, Oracle (42%) bottom. Swap results assume ~6 spare dice per player. See sim-results.md.
- **v0.6 sim (Run 8):** dice 43–59% match win rate; median 12 turns per match, 44% go to round 3; no large active-player edge; 20% of rounds end in a double KO won by the active player. Best of 3 sharpens matchups (Defense loses to the healing/Flex loadout ~99%). See sim-results.md.
- **v0.5.1 sim (Run 7):** every die wins 44–56%; average themed matchup within 9 points of 50/50. Remaining outlier: Defense loses to the healing/Flex loadout ~85%. Envenom rarely used (watch). Tavern Swap assumed a 3-die bench in the sim — a player with a bigger collection gets more counter-pick options. See sim-results.md.
- **Next:** tabletop playtest (turn time, ☣ targeting, how the Influence phase flows, whether Gold decisions feel good); later, rarity tiers and how dice are earned in the campaign.
- **Length (pre-v0.6 sim, where "rounds" meant today's turns; faces only):** without Last Call, 10 Resolve gave median 6 rounds / 90th pct 19, and defensive-healing mirrors never ended. With Last Call: median 6, 90th pct 9, turtle mirror ~12 (max 14).
- **Rulings (designer-approved):** Stand Fast reduces unblockable damage (it reduces Resolve loss, not a block). 
- **Open on new wording:** Bloodlust — if Stand Fast reduces a ☠'s damage to 0, does that ☠ still count?
- Bloodlust now rewards skulls: Berserker + Gambler/Monster/Goblin could be a deliberate risk build — watch.
- Mage's Arcane Surge + Assassin = strong anti-defense pair.
- Gambler's High Roller + Dragon's Hoard / Thief: possible runaway Gold economy — watch.
- Warlock's Dark Bargain on a ☠ costs the same 1 Resolve the ☠ would have — effectively a free face change on skulls. Intended, but watch.
