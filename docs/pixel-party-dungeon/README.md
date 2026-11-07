# Pixel Party Dungeon design notes

Why the game is the way it is: every major decision, the reason behind it, the
trade-off it accepted, and who made the call. The code lives in
[`apps/pixel-party-dungeon`](../../apps/pixel-party-dungeon/). The full design
spec is a Claude doc, "Game Design Spec: Pixel Party Dungeon". How the project
was run, and what it was used to teach, is in the
[case study](case-study.md).

## Starting point

The idea came from an 11-year-old designer. He wanted a game that combined two
games his dad loved: **Spelunky** (fast, chaotic, randomly generated caves) and
**Baldur's Gate 3** (dice, choices, a party of adventurers), which he was too
young to play or watch. The goal was to keep the *flavor* of both, made right
for kids his age.

He typed most of the inputs and made the decisions. His dad coached. An AI
agent (Claude) asked questions, wrote the spec, built the prototype and
surfaced assumptions and risks for him to decide on.

Framing decisions made before anything was built:

| Decision | Why | Trade-off accepted |
| --- | --- | --- |
| Watchable and playable by 10-year-olds is a **content and scope rule**, not a marketing line | The designer wanted something kids could watch over a shoulder or on a stream, so every system (including AI-written text) has to pass that test | Some BG3 flavor (darker themes, death) had to be translated, not copied |
| Defeated foes **poof into grey mist** | Keeps the thrill of winning a fight without death or gore | Less dramatic than the original games |
| Ask every clarifying question **before building** | Changes are cheapest before code exists, and the questions themselves teach what a game needs to decide | A slower start (27 questions in the first round) |
| Write the spec for another platform (**Google AI Studio**) in **build phases** with checklists | AI builders work best one testable layer at a time | The spec is longer than a one-page pitch |

## Core loop

| Decision | Why | Trade-off accepted | Came from |
| --- | --- | --- | --- |
| Real-time platforming, **turn-based fights** | Spelunky's movement plus BG3's tactical dice; turns also make fights easy to follow for viewers and easy to sync online later | Fights pause the action | Designer |
| A **short campaign** of 10 levels over several sessions | Sessions are about 30 minutes, but a story needs room | Requires saving between sessions | Designer |
| **Random levels** from hand-drawn room templates | Every run is different, but each room is designed to be fair | Less control over pacing than fully hand-built levels | Designer; method suggested by the agent |
| **New villain and goal each campaign**, written live by AI | Replay value; the designer wanted surprise | Needs a kid-safety filter and a fallback library | Designer |
| **One checkpoint per level** | Keeps some Spelunky tension; the designer asked for "not too many" | Losing a level's progress can sting | Designer |
| **Everyone presses Ready** to leave camp | Any keypress used to skip the camp screen by accident | One more step between levels | Risk review |

## Combat and survival

| Decision | Why | Trade-off accepted | Came from |
| --- | --- | --- | --- |
| **BG3-style death saves**, teammates can help you up | Being "down" creates drama and teamwork instead of instant loss | Fights can run longer | Designer |
| **Big dice at the top of the screen**, players press Roll themselves | Every roll becomes a moment the whole couch can react to | Slightly slower turns | Designer |
| **Hazards cost HP but never knock you out** | Spikes and fire shouldn't end a kid's turn in frustration; only fights can | Hazards are less scary | Designer |
| **Fall damage**, but standard one-room drops are free | Falls should matter (the designer spotted they didn't), but the level layout forces some drops and those shouldn't punish | A more complex rule | Designer |
| Only enemies that **can see the party** join a fight | Enemies stuck behind walls made fights impossible to finish | Fewer surprise ambushes | Risk review |
| **Run away** action (Agility check) | A way out of fights that can't be won or reached | Players can dodge hard fights | Risk review |
| **Friendly fire** is an option, off by default | Chaos is fun, but not when it's a sibling fight | One more setting | Designer |

## Gear, loot and gold

| Decision | Why | Trade-off accepted | Came from |
| --- | --- | --- | --- |
| **4 slots**: weapon, off-hand, armor, trinket | Simple enough for kids; off-hand fits shields, lanterns and spellbooks | Fewer things to collect than a 5-slot system | Designer (picked from options) |
| **Rarity tiers**: common is regular gear, uncommon and up are magical | The designer wanted both regular and magical equipment; colors make rarity readable at a glance | More items to balance | Designer (picked from options) |
| Gear only from **chests and bosses** | Rewards exploring and big fights, not grinding | Fewer drops | Designer |
| Swapping gear while **the game keeps running** | Keeps co-op flowing | You can get spotted while browsing | Designer (picked from options) |
| **No merchant** | The designer cut it: it didn't fit the game | Gold had no use until treasure maps | Designer |
| **Treasure maps**: spend gold at camp to plant a chosen magic item in a random later level | Gives gold a purpose and builds anticipation, while the item still has to be earned | More systems to explain | Designer's idea |
| Party can **pool gold**, but the group chooses **who the item is for** | Big purchases become a team decision, and nobody can grab it first | Pooling takes coordination | Designer, after the agent flagged the "fastest kid wins" risk |
| **No trading** gear or gold between characters | Avoids arguments and keeps personal loot personal | Less flexibility | Designer |
| Gear found before a **party wipe** waits in chests of its owner's color | Losing new gear felt unfair to a 10-year-old; this keeps it without making wipes free | Wipes are a little softer | Designer's idea |
| Best rarities **unlock with progress** (Epic before level 4, Legendary before level 7) | Stops a pooled Legendary from trivializing early levels | Less instant gratification | Risk review |

## Platform, saving and cost

| Decision | Why | Trade-off accepted | Came from |
| --- | --- | --- | --- |
| Spec targets **Google AI Studio**; a **Claude artifact prototype** was built to compare | Seeing a working prototype makes the AI Studio build easier to judge | Two builds to keep in sync | Designer asked "what could you build instead?" |
| **Two players per keyboard, controllers for 3–4** | Shared keyboards miss key presses with more than two players | Big groups need controllers | Risk review |
| **Auto-save** at level start, at camp and after buying a map | Campaigns span sessions; kids forget to save | No mid-level saves | Designer asked for saving |
| One **AI story per campaign**, with a ready-made backup | Cheap enough for now; the backup keeps the game working if AI is unavailable or the text fails the safety check | Some cost per adventure | Designer accepted; alternatives documented in the spec |

## Assumptions we surfaced

Part of the process was making assumptions visible, both the ones people made
without saying and the ones the AI agent filled in on its own. Each was kept,
changed or parked.

| Assumption | Whose | What happened |
| --- | --- | --- |
| "Google playground" means Google AI Studio's Build mode | Agent | Kept; it shaped the whole platform section |
| "Watchable" means streaming features | Agent | Changed: the designer meant content suitable for kids to watch |
| An answer of "no" to online safety meant no restrictions | Ambiguous | Clarified, and online play was redesigned around the platform's limits |
| One checkpoint per level | Agent | Kept |
| A merchant sells gear | Agent (carried from the first spec) | Changed: the merchant was removed entirely |
| Whoever opens a party chest keeps the item | Agent | Changed: the group picks the recipient |
| Gear is lost on a party wipe | Agent | Changed: it waits in owner-colored chests |
| Players don't need fall damage | Agent (gap) | Changed: the designer added it |
| "A new project" means a new app folder in this repo | Agent | Kept |

## Risks we found and what we did

From the risk review (the full list lives in the spec's Open risks section):

1. **Fights that couldn't end** → only visible enemies join, plus Run away.
2. **Arguments over party treasure** → the group picks who a pooled map is for.
3. **Skipping camp by accident** → everyone presses Ready.
4. **Losing gear on a wipe** → owner-colored recovery chests.
5. **Shared keyboards dropping key presses** → two players per keyboard.
6. **Required drops costing HP** → one-room drops are free.
7. **Buying power too early** → rarities unlock with progress.

Still open: online multiplayer, name safety in the AI Studio build, tuning the
gold economy across a full campaign, and whether finished campaigns should
unlock anything permanent.
