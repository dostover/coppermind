# Case study: coaching AI-assisted product development

**Example project:** Pixel Party Dungeon, a co-op dungeon crawler built with an AI agent
**My role:** coach for the product owner, on product-management and agentic-development practice
**Product owner:** a first-time product owner with no software background (my 11-year-old son)
**Tools:** Claude (spec, prototype, tests), GitHub, Google AI Studio as the target build platform
**Result:** idea to a phased design spec, a tested and playable prototype, and a shipped repository in one evening (about four hours), with 50+ decisions documented with their reasons

## The capability

I coach people to run AI-assisted product work well. The person I coach stays
the decision-maker; the AI agent does the heavy lifting; my job is to make sure
the right questions get asked, the AI's assumptions are visible, and every
decision is made deliberately and recorded with its reason.

That applies to any product owner, team lead or team new to working with AI
agents. This project is a strong test of it: the product owner had no product
or engineering background, so every practice had to be taught from first
principles, in plain language, while he kept ownership of every call. He typed
about 90% of the inputs.

## How I coach

These principles are the same whoever the product owner is:

1. **Ownership stays with the decision-maker.** I ask the question behind the
   question; I don't answer it for them. When they ask the agent to "just pick",
   they still confirm or change its recommendation.
2. **Make the agent's thinking visible.** Agents quietly fill gaps. I build the
   habit of asking the agent to list its assumptions, ask clarifying questions
   before building, and give options with a recommendation instead of deciding.
3. **Ask before you build.** Clarifying questions are cheapest before any code
   exists.
4. **Every decision has a reason and a trade-off.** Both get written down, so
   the team (and the agent) can revisit them later.
5. **Short loops with working software.** Build a little, demo it, react,
   adjust.
6. **Plain language first.** Real terms (assumption, trade-off, backlog) are
   introduced with one-line definitions, then used consistently.

## Capabilities demonstrated

| Capability | How I coached it on this project | Where it transfers |
| --- | --- | --- |
| **Framing context** | Before any solution, he defined who the product is for (players and people watching), what to keep from each inspiration, and the content rules for the audience. | Problem framing and product briefs for any team |
| **Building a shared ontology** | He settled a shared vocabulary with the agent for the product's concepts (classes, loot, treasure maps, camp, recovery chests). Some names were his; others the agent proposed and he approved. The same terms were then used in the spec, the code and with the agent. | Domain language for teams and for prompting agents reliably |
| **Surfacing human and agentic assumptions** | We separated what he assumed without saying from what the agent filled in on its own, then kept, changed or parked each one. He overturned several agent defaults: the merchant, who keeps shared loot, losing items after a failure. | Reviewing AI output critically; requirement discovery |
| **Clarifying questions** | 27 design questions were answered before a line of code, then focused rounds for new systems. | Discovery and refinement sessions |
| **Risk identification** | He asked "what's likely to go wrong?", reviewed a ranked list with fix options, and decided on each of 7 risks. | Pre-mortems and risk reviews |
| **Trade-off decisions** | Every option came with what it gains and what it costs. For example, he chose a slightly more complex fall rule so required moves wouldn't feel unfair. | Prioritization and stakeholder decisions |
| **Demoing** | A working prototype existed within the first two hours, so decisions were made by trying the product, and it was used to compare build platforms. | Sprint demos, prototyping before committing |
| **User perspective** | He wrote requirements from the users' side: what a 10-year-old can read, what's fun to watch, what feels unfair. | Acceptance criteria and user-centered requirements |
| **User interviews** | Next step: playtests with other players using a short interview script. Results will be added here. | User research |
| **Synthesizing feedback** | So far, his own feedback on the prototype (falls, lighting, inventory) became specific, scoped changes rather than a list of complaints. Finding patterns across other players' feedback follows the playtests. | Turning feedback into backlog items |
| **Backlog grooming and scope** | He cut scope (3 levels of a 10-level design), removed a feature that didn't fit, and deferred others (online play, companions). | Backlog refinement, MVP scoping |
| **Planning** | The spec is six build phases, each with a testable checklist, so another team or tool can continue one layer at a time. | Release planning, handoffs between teams and tools |

## Outcomes

- A design spec for a 10-level game, written in six build phases, with
  decisions, risks and mitigations.
- A playable prototype: four classes, generated levels, turn-based combat,
  equipment with rarities and magic effects, an in-game economy, recovery
  rules and auto-saving.
- 50+ design decisions, each recorded with its reason and trade-off (see the
  [design notes](README.md)).
- An automated test suite (11 checks), shipped to GitHub through pull
  requests.
- Repeatable workflows captured for future changes (release, design change,
  risk review).

## The story behind it

My son had a game idea: combine two games I love, Spelunky and Baldur's Gate 3,
one of which he was too young to play or watch, and keep their flavor in a way
that's right for kids his age. It started as a fun way to help him flesh out
the idea. It became a hands-on way to coach the practices behind AI-assisted
product development: the same ones I'd coach with a team, taught to someone
who had never seen them before.

## Resume and profile wording

Pick and adapt:

- Coach product owners through AI-assisted development: framing context,
  building a shared ontology with the AI agent, surfacing human and AI
  assumptions, and turning risks into explicit, documented trade-off decisions.
- Coached a first-time product owner with no software background from idea to
  a phased design spec, tested prototype and shipped repository in one
  evening; he made the product decisions, with 50+ documented with their
  rationale.
- Built a repeatable coaching loop for AI-assisted product work (context,
  ontology, assumptions, risks and trade-offs, demo, feedback, backlog,
  planning) and captured it as reusable team workflows.

One-line version: *I coach people to lead AI-assisted product work: they own
the decisions, the agent does the building, and every assumption, risk and
trade-off is made visible and recorded.*
