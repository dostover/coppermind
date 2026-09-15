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

### Google Docs export (optional)

A note can be exported (or re-exported) to a Google Doc in your own Drive -
the "Export to Google Docs" button on a note, and a connect/disconnect
control on `/library`. Unset (the default), this feature is simply absent
from the UI rather than erroring - same spirit as `ANTHROPIC_API_KEY`.

To turn it on:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or use an existing one) and enable the **Google Docs API**.
2. Under **APIs & Services → OAuth consent screen**, configure it for
   **External** user type (Internal requires a Google Workspace org) and add
   yourself as a **test user** - an app in "Testing" status works
   indefinitely for its listed test users without needing Google's review,
   which is all a single-user local app like this needs.
3. Under **APIs & Services → Credentials**, create an **OAuth client ID** of
   type **Web application**, with an authorized redirect URI of
   `http://localhost:3000/api/integrations/google/callback` (or whatever
   `GOOGLE_REDIRECT_URI` you set below).
4. Copy the resulting Client ID and Client secret into `.env.local`:

   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

5. Restart `npm run dev`, then click **Connect Google Docs** on `/library`.
   Google will warn that the app is unverified - that's expected for a
   personal OAuth client in Testing status; proceed as yourself, the test
   user you added in step 2.

Tokens are stored in the same local SQLite database as everything else
(`google_auth` table, one row - single implicit user, no per-user auth).
Disconnecting from `/library` only forgets them locally; to revoke access on
Google's side too, visit https://myaccount.google.com/permissions.

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
      notes/[id]/export-to-docs/route.ts   POST -> exports/re-exports the note to Google Docs
      notes/route.ts              GET ?q= search
      integrations/google/        OAuth connect/callback/disconnect routes
  components/                Nav, UploadForm, ReviewEditor, GoogleConnectionControl
  lib/
    db.ts                    SQLite schema + repositories (notes, handwriting_examples, handwriting_profile, google_auth)
    config.ts                CONFIDENCE_THRESHOLD, GOOGLE_* and other tunables
    handwritingProfile.ts    getHandwritingContext / recordHandwritingCorrection / updateHandwritingProfile
    ai/
      types.ts               AIProvider interface (narrowed to transcribe + evaluateHandwritingCorrection)
      mockProvider.ts         Deterministic no-key fallback
      claudeProvider.ts       Real Anthropic implementation (structured tool-call output)
      index.ts                getAIProvider() factory (env-based selection)
    google/
      oauth.ts                OAuth flow + getValidAccessToken() (auto-refreshing)
      docsExport.ts           Maps a note's segments onto Google Docs API requests
```

## Known limitations (by design, for this phase)

- No authentication - single implicit local user.
- Processing is async (a lightweight in-process job runner, not a real queue
  broker) - fine for one local user, but jobs don't survive across separate
  machines/processes and there's no horizontal scaling.
- Search is naive substring matching over SQLite.
- Single page per note; multi-page grouping isn't implemented.

All of these map to abstractions (`AIProvider`, the `notes`/`handwriting_*`
tables, `SearchIndex`-shaped query in `notesRepo.listAll`) chosen so the
later upgrade path in `docs/inkwell/02-architecture.md` is additive, not a
rewrite.
