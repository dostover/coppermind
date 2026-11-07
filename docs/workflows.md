# Workflows

Short pointers to the Claude skills this project relies on for repeatable
engineering workflows. The skills themselves live in the Claude skill
library, not in this repo — invoke them by name and follow their own
instructions for the full procedure, the same way `risks.md` points at the
`run-product-ceremony` skill rather than embedding it.

## Shipping a change

Branching, committing (with the right attribution trailer), bundling the
change over to the linked Mac, pushing, opening and squash-merging the PR on
GitHub, and syncing both clones and cleaning up afterward — see the
`ship-coppermind-pr` skill.

## Testing and fixing Inkwell end-to-end

Resetting the dev server cleanly, running scoped parallel test passes,
calibrating bug/vulnerability severity against Inkwell's single-implicit-user
scope, fixing, and verifying (type-check, lint, build, a targeted regression
script) before shipping — see the `inkwell-e2e-test-and-fix` skill.

## Tuning Rondolette's physics

Turning play-test feedback ("too bouncy", "drops in too easily") into measured
changes to the `PHYS` settings: run the tuning harness on the current settings
and a few candidates, pick the smallest change that matches the feedback, keep
the previous version so it can be restored exactly, and record the result in
`docs/rondolette/README.md`. See the `rondolette-tune-physics` skill and
`apps/rondolette/tests/tune-physics.cjs`.

## Releasing a Rondolette change

Rondolette runs in three places: the Netlify site (`apps/rondolette/index.html`
with Firebase), the Claude artifact prototype, and this repo. Applying a change
to both builds, running the multiplayer end-to-end test, shipping the PR,
redeploying Netlify and republishing the artifact — see the `rondolette-release`
skill and `apps/rondolette/tests/multiplayer.test.cjs`.

## Adding a new app

Laying out `apps/<name>/` (`index.html`, `README.md`, `screenshots/`,
`tests/`), writing the README in the same shape as the other apps, capturing
screenshots and a headless test, listing the app in the root README and here,
and shipping it — see the `add-coppermind-app` skill.

## Releasing a Pixel Party Dungeon change

Pixel Party Dungeon runs in two places: the Claude artifact (with Claude-written
stories and saves in the host's private storage) and
`apps/pixel-party-dungeon/index.html`, the same page wrapped to run standalone.
Making the change once, running `apps/pixel-party-dungeon/tests/smoke.py`,
republishing the artifact without dropping its capabilities, and shipping the
PR — see the `pixel-party-dungeon-release` skill.

## Changing Pixel Party Dungeon's design

Turning a new rule or feature into clarifying questions with recommended
defaults, building it, adding a smoke-test check, and updating every section of
the design spec it touches (the Claude doc "Game Design Spec: Pixel Party
Dungeon") before releasing — see the `pixel-party-dungeon-design-change` skill.

## Reviewing Pixel Party Dungeon for risks

Finding what's likely to go wrong for families playing (soft-locks,
unfairness, exploits, input, saves, story safety), asking how to fix each with a
recommended option, applying the answers, and updating the spec's Open risks —
see the `pixel-party-dungeon-risk-review` skill. Game risks live in the spec;
`risks.md` stays for team and business risks.
