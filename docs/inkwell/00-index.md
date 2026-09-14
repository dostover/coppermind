# Inkwell — Spec-DD Documentation Index

Product: Handwritten Notes AI ("Inkwell"). Source: full Spec-DD product specification provided 2026-08-13.

This is the Phase 1–6 documentation set (§41 of the source spec), produced before any implementation begins. Phase 7 (Implementation) is not started — per the spec, it should begin with the thin end-to-end prototype (§43), not the full application.

| Doc | Contents |
|---|---|
| [01-requirements.md](01-requirements.md) | Phase 1 — numbered functional requirements (FR-x.x) by capability area, explicit non-goals, and a table of every ambiguity found in the source spec with the assumption made to resolve it. |
| [02-architecture.md](02-architecture.md) | Phase 2 — proposed stack, system diagram, application/auth/AI/storage/search architecture, processing pipeline, and the handwriting-learning architecture. |
| [03-ux-screens.md](03-ux-screens.md) | Phase 3 — the 9 primary screens (sign in, library, capture, processing, review, note detail, search, folder/tag management, settings) with critical interactions for each. |
| [04-data-model.md](04-data-model.md) | Phase 4 — full relational schema (tables, columns, types, indexes, cascade rules) for every entity. |
| [05-ai-contracts.md](05-ai-contracts.md) | Phase 5 — structured input/output contracts for every AI operation (transcribe, learning evaluation, note classification, summarize, tags, entities, relationships, search answering). |
| [06-acceptance-criteria.md](06-acceptance-criteria.md) | Phase 6 — Given/When/Then acceptance criteria per feature, cross-checked against the spec's Definition of Done (§42). |

## How to use this set

- Requirements and architecture are meant to be read together before any code is written — architecture decisions (e.g., Postgres + pgvector, the `AIProvider`/`HandwritingProfile` abstractions) exist specifically to satisfy requirements that call for future evolvability (swappable AI models, upgradeable search backend, evolvable handwriting learning).
- The **Ambiguities & Assumptions** table in 01-requirements.md is the place to push back if any assumption doesn't match intent — everything downstream (schema, contracts, acceptance criteria) was built on top of those assumptions.
- Next step per the spec's own process: build the thin vertical prototype (§43) to validate the core hypothesis — that transcription accuracy measurably improves as a single user's corrections accumulate — before investing in the full library/search/organization system.
