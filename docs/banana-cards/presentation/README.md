# Banana Cards presentation

The 15-slide presentation of Banana Cards: the opportunity, the core idea, how
it works, a live demo, and the decisions, assumptions, guardrails, measures and
next steps behind it.

- **`presentation.html`** — open it in a browser to read every slide with its
  speaker notes. It loads its two typefaces (Oswald and Nunito Sans) from
  Google Fonts, so it looks right when you're online.
- **`slides/`** and **`deck.json`** — the source of each slide and the deck's
  order, sections and fonts, as exported from the editable deck in Claude
  (a Slides artifact). Card images point at `art/`.
- **`art/`** — PNG renders of the card illustrations the slides use, from
  `apps/banana-cards/public/cards/`.

The editable deck in Claude is the original: edit it there, then refresh this
copy. To present, use the Claude deck (it has Present mode and exports to
PowerPoint and PDF).

The demo slide's speaker notes walk through the click path, using the seeded
demo fans (`npm run seed` in `apps/banana-cards` first).
