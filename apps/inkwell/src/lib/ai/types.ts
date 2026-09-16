// AIProvider interface - Phase 5 AI Contracts, narrowed to what this walking
// skeleton needs (transcribe + evaluateHandwritingCorrection). The other
// methods on the full interface (analyzeNote, summarize, generateTags,
// extractEntities, identifyRelationships, answerSearchQuery) belong to
// deferred features and are intentionally not part of this phase's contract -
// see claude/08-walking-skeleton-scope.md.

export interface HandwritingContext {
  /** Top recurring personal terms/names, e.g. ["Rilldale", "Kessandra"]. */
  vocabularyHints: string[];
  /** Recurring AI-misread -> user-corrected pairs, e.g. { from: "there", to: "three" }. */
  correctionPatternHints: { fromPattern: string; toPattern: string }[];
}

export interface TranscribeInput {
  /** Path to the uploaded image, relative to the app's public/ dir. */
  imagePath: string;
  handwritingContext: HandwritingContext;
  confidenceThreshold: number;
}

export type StructureType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "numbered_item"
  | "dialogue"
  | "table_cell"
  | "line";

// Where a segment lives on the source page image - attempt #4 at this
// feature (see gridOverlay.ts for the full history/rationale). Derived from
// the grid cell(s) the model reports touching, not from raw coordinates.
export interface SourceRegion {
  /** [left, top, width, height], each 0-1 fractional relative to the
   *  displayed page image - resolution-independent, so it lines up on the
   *  original photo regardless of whatever resized copy was sent to the
   *  model for transcription. */
  bbox: [number, number, number, number];
}

export interface TranscriptSegment {
  /** Stable id, referenced by review-UI editing and correction diffing. */
  id: string;
  text: string;
  structureType: StructureType;
  crossedOut: boolean;
  emphasis: "none" | "underline" | "bold_or_heavy";
  /** 0-1, model's raw self-reported confidence for this segment. */
  confidence: number;
  /** = confidence < confidenceThreshold. Providers set an initial value at
   *  transcribe time, but db.ts recomputes it from the stored `confidence`
   *  against the live CONFIDENCE_THRESHOLD on every read, so changing the
   *  threshold updates old notes without re-transcribing them (AC-5). */
  reviewRequired: boolean;
  /** Approximate on-page location, used to highlight the source handwriting
   *  when this segment is focused in the review UI. Undefined when the model
   *  didn't report a usable grid cell for this segment - no highlight is
   *  shown rather than a wrong one. */
  sourceRegion?: SourceRegion;
}

export interface TranscribeOutput {
  segments: TranscriptSegment[];
  pageLevelNotes?: string[];
}

// Batched sibling of transcribe()/TranscribeInput/TranscribeOutput, added so
// a multi-page note can be transcribed with one provider call instead of one
// per page. This does NOT reduce image-token cost (Claude's vision pricing
// is per-image regardless of how many share a request - see the token-cost
// note in ClaudeAIProvider.transcribeBatch), only the *non-image* overhead:
// one system prompt + one handwriting-context block instead of N copies of
// each. Kept as a separate method rather than folding into transcribe() so
// the existing single-page path (used for per-page retry, where re-sending
// every other already-succeeded page's image would be pure waste) stays
// untouched and simple.
export interface TranscribeBatchInput {
  pages: { pageId: string; imagePath: string }[];
  handwritingContext: HandwritingContext;
  confidenceThreshold: number;
}

export interface TranscribeBatchOutput {
  /** One entry per input page, matched back up by pageId (order not assumed). */
  pages: { pageId: string; segments: TranscriptSegment[]; pageLevelNotes?: string[] }[];
}

export type CorrectionClassification =
  | "handwriting_correction"
  | "content_edit"
  | "rewrite"
  | "formatting"
  | "addition";

export interface LearningEvalInput {
  aiText: string;
  correctedText: string;
  originalConfidence: number;
}

export interface LearningEvalOutput {
  classification: CorrectionClassification;
  /** 0-1; low-confidence classifications default to a small non-zero weight
   *  rather than 0, per spec §13 - a lower-weight example beats a discarded one. */
  learningWeight: number;
  rationale: string;
}

// Narrowed from the full Phase 5 `generateTags` contract (05-ai-contracts.md
// §5): the full contract also passes the adaptive `summary`, but summarize()
// is still deferred per claude/08-walking-skeleton-scope.md, so this takes
// transcription text directly. `existingUserTags` is passed so the model can
// reuse the user's vocabulary instead of minting near-duplicates (FR-7.6).
export interface GenerateTagsInput {
  transcription: string;
  existingUserTags: string[];
}

export interface GenerateTagsOutput {
  tags: {
    name: string;
    matchedExistingTag: boolean;
    confidence: number;
  }[];
}

export interface AIProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>;
  transcribeBatch(input: TranscribeBatchInput): Promise<TranscribeBatchOutput>;
  evaluateHandwritingCorrection(input: LearningEvalInput): Promise<LearningEvalOutput>;
  generateTags(input: GenerateTagsInput): Promise<GenerateTagsOutput>;
}
