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
