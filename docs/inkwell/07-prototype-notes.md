# Inkwell — Prototype Build Notes

**Status:** Built and verified in-session (mock provider). Delivered as `inkwell-prototype.zip`.
**Date:** 2026-08-13

## What was built
Thin vertical prototype per spec section 43 / Phase 7 kickoff: FastAPI backend + vanilla JS frontend implementing the full loop — upload → transcribe → confidence marking → review/correct → diff → classify correction → store HandwritingExample → recompute HandwritingProfile → next page's transcription consults the profile.

Code structure mirrors the Phase 2 architecture doc's `AIProvider` and `HandwritingProfile` abstractions:
- `backend/ai_provider.py` — `AIProvider` interface, `MockAIProvider` (deterministic, no network), `ClaudeAIProvider` (real, gated on `ANTHROPIC_API_KEY`, fully implemented but untested live since no key was available in-session).
- `backend/handwriting_profile.py` — `get_handwriting_context` / `record_handwriting_correction` / `update_handwriting_profile`.
- `backend/storage.py` + `backend/main.py` — SQLite persistence, FastAPI routes.
- `frontend/` — capture, review (split image/transcription), library/stats, profile views.

## Mock provider design
No `ANTHROPIC_API_KEY` was available in this session (user chose to proceed with mock rather than provide one). Mock provider cycles through 3 built-in demo pages (Rilldale/wizard/amulet — the spec's own running example) with seeded OCR-error words, and deterministically applies learned `correction_patterns` from the profile to simulate what a real vision model would do in-context. This validates the *pipeline mechanics*, not real OCR accuracy.

## Verified live in-session
Page 1: 7 segments, 4 flagged (wizzard, Rilldaie ×2, watchtowfr, amvlet). After correcting + saving: profile picked up 4 correction patterns. Page 2 (new sentences, same vocabulary): 0 flagged, 3 segments auto-corrected from profile. Page 3: same result holds. Screenshots taken via headless Playwright confirm the UI renders and behaves correctly (capture, review with flagged/auto-corrected badges, profile page with patterns/vocabulary/learning log).

## Known gap / next step
Real transcription accuracy on actual handwriting is unverified — needs a live run with `ANTHROPIC_API_KEY` set (user was going to look into getting one; steps given: platform.claude.com → Settings → Billing → API Keys). `ClaudeAIProvider` is fully coded against the Phase 5 AI contracts (transcribe + evaluateHandwritingCorrection) and should work once a key is supplied — no code changes needed, just set the env var.
