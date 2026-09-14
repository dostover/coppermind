import { randomUUID } from "crypto";
import {
  handwritingExamplesRepo,
  handwritingProfileRepo,
  type CorrectionPattern,
} from "./db";
import type { HandwritingContext, LearningEvalOutput } from "./ai/types";

// The rest of the app - and every AIProvider call - accesses handwriting
// knowledge only through these three functions (Phase 2 Architecture §5.3),
// so the underlying implementation (currently: recompute simple pattern
// tables from HandwritingExample history) can later be replaced without
// touching transcribe()'s caller. Single implicit user for this phase, so
// there is no userId parameter yet - that's the one change a real multi-user
// version would need here.

const MIN_OCCURRENCES_FOR_PATTERN = 2;
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
 * history (not appended - recomputed, per docs/inkwell/04-data-model.md),
 * weighted toward repeated corrections. This is entirely data-driven (no
 * model training step), satisfying the source spec's "do not fine-tune
 * after every correction" guidance for MVP.
 */
export function updateHandwritingProfile(): void {
  const examples = handwritingExamplesRepo.listAll();

  // Correction patterns: group handwriting_correction-classified examples by
  // (aiText -> correctedText), keep pairs confirmed at least twice.
  const patternCounts = new Map<string, CorrectionPattern>();
  for (const ex of examples) {
    if (ex.classification !== "handwriting_correction") continue;
    const key = `${ex.ai_text.toLowerCase()}=>${ex.corrected_text.toLowerCase()}`;
    const existing = patternCounts.get(key);
    if (existing) {
      existing.occurrences += 1;
      existing.lastConfirmedAt = ex.created_at;
    } else {
      patternCounts.set(key, {
        fromPattern: ex.ai_text,
        toPattern: ex.corrected_text,
        occurrences: 1,
        lastConfirmedAt: ex.created_at,
      });
    }
  }
  const correctionPatterns = [...patternCounts.values()]
    .filter((p) => p.occurrences >= MIN_OCCURRENCES_FOR_PATTERN)
    .sort((a, b) => b.occurrences - a.occurrences || (a.lastConfirmedAt < b.lastConfirmedAt ? 1 : -1));

  // Vocabulary: recurring corrected terms (proxy for proper nouns/unusual
  // tokens) that appear across >= 2 examples, from any classification.
  const termCounts = new Map<string, number>();
  for (const ex of examples) {
    const term = ex.corrected_text.trim();
    if (!term || term.includes(" ")) continue; // single-token terms only, for this phase
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  }
  const vocabulary = [...termCounts.entries()]
    .filter(([, count]) => count >= MIN_OCCURRENCES_FOR_PATTERN)
    .sort((a, b) => b[1] - a[1])
    .map(([term, frequency]) => ({ term, frequency }));

  handwritingProfileRepo.upsert({
    vocabulary,
    correctionPatterns,
    updatedAt: new Date().toISOString(),
  });
}
