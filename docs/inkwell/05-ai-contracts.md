# Inkwell — Phase 5: AI Contracts

**Spec-DD Phase:** 5 of 7 (AI Contracts)
**Status:** Draft for review
**Date:** 2026-08-13

Every AI operation returns structured, schema-validated JSON (§41 Phase 5, FR-14.4) — no operation relies on parsing free-form prose. Each operation corresponds to one narrowly-scoped prompt (§31); prompts themselves are an implementation detail and not fixed here, but every prompt must be constrained (e.g., via tool-call/JSON-mode output) to produce exactly the shape below. Types are given in TypeScript-style interfaces for precision; the actual wire format is JSON.

---

## 1. `transcribe`

**Responsibility:** faithfully reproduce handwriting only. No interpretation, no summarization, no corrections to grammar/content (§7).

```ts
interface TranscribeInput {
  pages: {
    pageId: string
    imageUrl: string            // short-lived signed URL to preprocessed image
    pageNumber: int
  }[]
  handwritingContext: HandwritingContext   // from getHandwritingContext(userId) — §5.3/9 of Architecture
  confidenceThreshold: number              // app-configured (FR-4.6), passed through so the model's
                                            // uncertainty flagging aligns with what the UI will honor
}

interface HandwritingContext {
  vocabularyHints: string[]                 // top recurring personal terms/names, e.g. ["Rilldale","Kessandra"]
  correctionPatternHints: { fromPattern: string; toPattern: string }[]  // e.g. [{ from: "there", to: "three" }]
}

interface TranscribeOutput {
  pages: {
    pageId: string
    segments: TranscriptSegment[]
    pageLevelNotes?: string[]   // e.g. "drawing present, not transcribed", "table detected, reproduced best-effort"
  }[]
}

interface TranscriptSegment {
  id: string                    // stable id, referenced by ConfidenceOutput and review-UI selection
  text: string
  structureType: 'paragraph' | 'heading' | 'list_item' | 'numbered_item' | 'dialogue' | 'table_cell' | 'line'
  crossedOut: boolean
  emphasis: 'none' | 'underline' | 'bold_or_heavy'
  sourceRegion?: { page: int; bbox: [number, number, number, number] } | null   // best-effort, nullable (FR-3.6)
  confidence: number            // 0-1, model's raw self-reported confidence for this segment
  reviewRequired: boolean       // = confidence < confidenceThreshold, computed by the provider layer,
                                 // not left to the frontend to recompute
}
```

**Notes:** `reviewRequired` is computed against the *app-configured* threshold at the provider-abstraction layer (not baked into the model call), so changing the threshold app-wide doesn't require a new model call — the raw `confidence` is retained per segment specifically so a threshold change can be reapplied retroactively without re-transcribing.

---

## 2. Handwriting-Learning Evaluation — `evaluateHandwritingCorrection`

**Responsibility:** classify a single user edit as handwriting-signal or not (§13).

```ts
interface LearningEvalInput {
  aiText: string
  correctedText: string
  surroundingContext: string      // a few sentences before/after, for content-vs-handwriting judgment
  sourceRegion?: { page: int; bbox: [number, number, number, number] } | null
  originalConfidence: number
}

interface LearningEvalOutput {
  classification: 'handwriting_correction' | 'content_edit' | 'rewrite' | 'formatting' | 'addition'
  learningWeight: number          // 0-1; low-confidence classifications default to a small non-zero weight
                                   // rather than 0, per §13 "preserving the example with a lower weight
                                   // is preferable to ignoring it completely"
  rationale: string               // short internal-only explanation, useful for debugging/QA, not shown to user
}
```

**Notes:** Runs once per changed segment during `SAVE_CORRECTIONS`, diffed at the `TranscriptSegment` level (not a whole-document diff), so classification has tight, relevant context.

---

## 3. `analyzeNote` (Note Classification)

**Responsibility:** determine note type only — a distinct, narrow step from summarization (§15/§31), because summarization's shape depends on this result.

```ts
interface AnalyzeNoteInput {
  transcription: string
  existingUserNoteTypes: string[]   // types this user's other notes have already been assigned, for consistency
}

interface AnalyzeNoteOutput {
  noteType: string          // open-ended; may reuse an existing type or propose a new one (§15)
  confidence: number
  isNovelType: boolean      // true if this doesn't match any existingUserNoteTypes
}
```

---

## 4. `summarize`

**Responsibility:** adaptive summary shaped by `noteType` (§16). Rather than one rigid schema, the contract defines a **base envelope** plus **type-specific field sets**; unrecognized/novel types fall back to the generic envelope.

```ts
interface SummarizeInput {
  transcription: string
  noteType: string
  noteTypeConfidence: number
}

interface SummarizeOutput {
  noteType: string
  fields: SummaryFields          // shape varies by noteType, see below
  freeTextSummary: string        // always present: 1-3 sentence plain-language summary,
                                  // used as the library-card snippet regardless of type
}

// Discriminated by noteType. Known shapes (§16); unlisted/novel types use `GenericSummaryFields`.
type SummaryFields =
  | { kind: 'brainstorm'; coreIdeas: string[]; potentialDirections: string[]; openQuestions: string[]; notableConnections: string[] }
  | { kind: 'meeting_notes'; summary: string; decisions: string[]; actionItems: { text: string; owner?: string }[]; peopleMentioned: string[]; followUps: string[] }
  | { kind: 'creative_writing'; sceneSummary: string; characters: string[]; locations: string[]; plotDevelopments: string[]; importantConcepts: string[] }
  | { kind: 'todo_list'; tasks: { text: string; deadline?: string; priority?: 'low'|'medium'|'high' }[] }
  | { kind: 'journal'; summary: string; themes: string[]; notableEvents: string[] }
  | GenericSummaryFields

interface GenericSummaryFields {
  kind: 'generic'
  keyPoints: string[]
}
```

**Notes:** `SummaryFields` is persisted as-is into `notes.summary` (JSONB). The Note Detail UI (Phase 3 §6) renders whichever `kind` it receives; adding a new type-specific shape later is additive (new union member), not a breaking schema change — this satisfies §15's "not limited to these categories."

---

## 5. `generateTags`

**Responsibility:** propose tags, preferring the user's existing vocabulary (§17).

```ts
interface GenerateTagsInput {
  transcription: string
  summary: SummaryFields
  existingUserTags: { name: string; normalizedName: string }[]   // full tag vocabulary for this user
}

interface GenerateTagsOutput {
  tags: {
    name: string                 // if reused, must exactly match an existingUserTags entry's `name`
    matchedExistingTag: boolean
    confidence: number
  }[]
}
```

**Notes:** The prompt is explicitly instructed to check `existingUserTags` before proposing a new tag string, and only mint a new tag when no reasonable existing match exists — directly implementing FR-7.6's "prefer existing tags over near-duplicates."

---

## 6. `extractEntities`

**Responsibility:** identify people, places, organizations, projects, concepts (feeds both tagging context and relationship detection).

```ts
interface ExtractEntitiesInput {
  transcription: string
}

interface ExtractEntitiesOutput {
  entities: {
    text: string                 // as written, e.g. "Rilldale"
    type: 'person' | 'place' | 'organization' | 'project' | 'concept' | 'event' | 'other'
    mentions: number             // occurrence count within this note
  }[]
}
```

---

## 7. `identifyRelationships`

**Responsibility:** find meaningful relationships to the user's *existing* notes (§19).

```ts
interface RelationshipInput {
  noteId: string
  transcription: string
  entities: ExtractEntitiesOutput['entities']
  candidateNotes: {              // pre-filtered by the search/embedding layer (top-K by embedding similarity
                                  // + any notes sharing an entity/tag) — the AI does not scan the whole library
    noteId: string
    title: string
    summary: string
    tags: string[]
    entities: string[]
  }[]
}

interface RelationshipOutput {
  relationships: {
    targetNoteId: string
    relationshipType: 'same_topic' | 'same_person' | 'same_project' | 'same_place' | 'similar_idea' |
                       'continuation' | 'contradiction' | 'supporting_information' | 'reference' |
                       'derived_idea' | string    // open string type permits novel relationship labels
    confidence: number
    basis: string                 // short explanation, stored in note_relationships.basis for UI/debug
  }[]
}
```

**Notes:** Candidate pre-filtering (via the `SearchIndex`, see Architecture §7) keeps this call bounded and cheap regardless of library size — this is what lets §19's "relationships even months apart" work without an O(n²) all-pairs AI comparison.

---

## 8. `answerSearchQuery`

**Responsibility:** ground a natural-language answer in retrieved notes, always citable (§20/§22).

```ts
interface SearchAnswerInput {
  query: string
  retrievedNotes: {
    noteId: string
    title: string
    snippet: string               // relevant excerpt(s), not full transcription, to bound prompt size
    date: string
  }[]
}

interface SearchAnswerOutput {
  answer: string                  // natural-language answer
  citations: { noteId: string; supportingSnippet: string }[]   // every claim in `answer` traceable to ≥1 citation
  confidence: 'high' | 'low'      // low confidence surfaces a softer UI treatment ("here's what I could find")
}
```

**Notes:** If `retrievedNotes` is empty or all below a relevance floor, the provider layer short-circuits and returns a "no relevant notes found" result without calling the model — avoiding a hallucinated answer with no grounding.

---

## Cross-Cutting Contract Rules

1. **No operation is allowed to return unstructured prose as its primary payload.** Every interface above is enforced via the model's structured-output/tool-call mode; a response that fails schema validation is treated as a provider error (triggers pipeline-stage retry/failure, not silent fallback to raw text).
2. **Every AI-authored field that reaches the database carries enough provenance to support FR-15.1/FR-15.2** — e.g., `title_source`, `summary_source`, `note_tags.source` — so the application layer can always tell AI output from user-confirmed content and never silently overwrite the latter.
3. **All AI operations receive only the minimum data required** (§26/FR-1.8): `transcribe` receives image URLs + this user's own handwriting context only; `summarize`/`generateTags`/etc. receive transcription text, never the raw image; `identifyRelationships` receives only pre-filtered candidate summaries from the *same user's* notes, never other users' data.

---

*Next: Phase 6 — Acceptance Criteria.*
