# Inkwell — walking skeleton

Turn a photo of a handwritten page into a transcribed, corrected, searchable
note - and have the app learn from every correction you make, so the next
page in your handwriting comes back cleaner.

This is **not** the full product described in `../../docs/inkwell/` - it's a
deliberately narrow first build (a "walking skeleton") that validates the
core loop the whole spec is really betting on: does transcription accuracy
measurably improve as one person's corrections accumulate? Scope, stack
choices, and every deferred feature are recorded in the Inkwell Claude
project as `claude/08-walking-skeleton-scope.md`.

## What's implemented

Capture (single page) → transcribe → confidence-flag → review & correct →
handwriting learning → basic library & search. See
`docs/inkwell/01-requirements.md` for the FR numbers this covers.

## What's deliberately not here yet

Multi-page notes, folders, tags, adaptive per-type summaries, relationships,
retention policies, accounts/auth, duplicate detection, and real hybrid/
semantic search. All in the full spec; all out of scope for this phase.

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000. With no `ANTHROPIC_API_KEY` set, Inkwell runs on
a **deterministic mock provider**: uploads work end-to-end, but the
"transcription" is fixed demo content (a running Rilldale/wizard/amulet
example with a few seeded misread words) rather than a real reading of your
image. This is intentional - it validates the pipeline mechanics (upload →
review → correction → learning → improved next transcription) without
needing an API key. Correct the same seeded word a couple of times and
re-upload; you should see the mock "learn" it.

### Turning on real transcription

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

in `.env.local`, then restart `npm run dev`. No code changes needed - the
`AIProvider` factory in `src/lib/ai/index.ts` picks `ClaudeAIProvider`
automatically once a key is present.

## Project structure

```
src/
  app/
    page.tsx                Landing page
    upload/page.tsx          Capture flow (upload -> processing -> redirect)
    notes/[id]/page.tsx       Review workspace (image + editable transcription)
    library/page.tsx          Search + list saved notes
    api/
      notes/upload/route.ts       POST image -> creates + synchronously transcribes a note
      notes/[id]/route.ts         GET a note / PATCH corrections (triggers handwriting learning)
      notes/[id]/retry/route.ts   POST -> retries a failed transcription without re-uploading
      notes/route.ts              GET ?q= search
  components/                Nav, UploadForm, ReviewEditor
  lib/
    db.ts                    SQLite schema + repositories (notes, handwriting_examples, handwriting_profile)
    config.ts                CONFIDENCE_THRESHOLD and other tunables
    handwritingProfile.ts    getHandwritingContext / recordHandwritingCorrection / updateHandwritingProfile
    ai/
      types.ts               AIProvider interface (narrowed to transcribe + evaluateHandwritingCorrection)
      mockProvider.ts         Deterministic no-key fallback
      claudeProvider.ts       Real Anthropic implementation (structured tool-call output)
      index.ts                getAIProvider() factory (env-based selection)
```

## Known limitations (by design, for this phase)

- No authentication - single implicit local user.
- Processing is synchronous (the upload request waits for the AI call to
  finish) rather than an async pipeline with job stages.
- Search is naive substring matching over SQLite.
- Single page per note; multi-page grouping isn't implemented.

All of these map to abstractions (`AIProvider`, the `notes`/`handwriting_*`
tables, `SearchIndex`-shaped query in `notesRepo.listAll`) chosen so the
later upgrade path in `docs/inkwell/02-architecture.md` is additive, not a
rewrite.
