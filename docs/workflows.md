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
