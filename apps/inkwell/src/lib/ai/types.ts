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

export interface TranscriptSegment {
  /** Stable id, referenced by review-UI editing and correction diffing. */
  id: string;
  text: string;
  structureType: StructureType;
  crossedOut: boolean;
  emphasis: "none" | "underline" | "bold_or_heavy";
  /** 0-1, model's raw self-reported confidence for this segment. */
  confidence: number;
  /** = confidence < confidenceThreshold, computed by the provider layer. */
  reviewRequired: boolean;
}

export interface TranscribeOutput {
  segments: TranscriptSegment[];
  pageLevelNotes?: string[];
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

export interface AIProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>;
  evaluateHandwritingCorrection(input: LearningEvalInput): Promise<LearningEvalOutput>;
}
