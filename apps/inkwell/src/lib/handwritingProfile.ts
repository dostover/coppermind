import { randomUUID } from "crypto";
import { handwritingExamplesRepo, handwritingProfileRepo } from "./db";
import { computeProfileTables } from "./handwritingLearning";
import type { HandwritingContext, LearningEvalOutput } from "./ai/types";

// The rest of the app - and every AIProvider call - accesses handwriting
// knowledge only through these three functions (Phase 2 Architecture §5.3),
// so the underlying implementation (currently: recompute simple pattern
// tables from HandwritingExample history) can later be replaced without
// touching transcribe()'s caller. Single implicit user for this phase, so
// there is no userId parameter yet - that's the one change a real multi-user
// version would need here.

const MAX_HINTS = 20;

export function getHandwritingContext(): HandwritingContext {
  const profile = handwritingProfileRepo.get();
  return {
    vocabularyHints: profile.vocabulary.slice(0, MAX_HINTS).map((v) => v.term),
    correctionPatternHints: profile.correctionPatterns
      .slice(0, MAX_HINTS)
      .map((p) => ({ fromPattern: p.fromPattern, toPattern: p.toPattern })),
  };
}

export function recordHandwritingCorrection(input: {
  noteId: string;
  segmentId: string;
  aiText: string;
  correctedText: string;
  originalConfidence: number | null;
  evaluation: LearningEvalOutput;
}): void {
  handwritingExamplesRepo.create({
    id: randomUUID(),
    noteId: input.noteId,
    segmentId: input.segmentId,
    aiText: input.aiText,
    correctedText: input.correctedText,
    classification: input.evaluation.classification,
    learningWeight: input.evaluation.learningWeight,
    originalConfidence: input.originalConfidence,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Recomputes the HandwritingProfile from the full HandwritingExample
 * history (not appended - recomputed, per docs/inkwell/04-data-model.md).
 * Each correction is compared word by word, so a misread name is learned
 * from the words that changed rather than requiring the same whole line to
 * be corrected twice (see handwritingLearning.ts). Entirely data-driven (no
 * model training step), per the source spec's "do not fine-tune after every
 * correction" guidance for MVP.
 */
export function updateHandwritingProfile(): void {
  const { vocabulary, correctionPatterns } = computeProfileTables(handwritingExamplesRepo.listAll());
  handwritingProfileRepo.upsert({
    vocabulary,
    correctionPatterns,
    updatedAt: new Date().toISOString(),
  });
}
