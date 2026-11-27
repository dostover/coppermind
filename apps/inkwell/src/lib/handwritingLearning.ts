// Word-level learning from handwriting corrections.
//
// Corrections are stored per transcript segment, which for real handwriting
// is a whole line or sentence. The first version of updateHandwritingProfile
// only counted a pattern when the exact same whole-line before/after pair
// appeared twice, which real notes essentially never produce: a misread name
// sits in a different sentence every time, often with different punctuation
// ("Captain Eedanar" vs "Captain Eedanar,"). On real data that left the
// profile empty after 99 handwriting corrections. This module diffs each
// correction word by word and learns from just the words that changed.
//
// Kept free of runtime imports so it can be exercised directly against a copy
// of the real database without starting the app.

import type { CorrectionPattern, VocabularyEntry } from "./db";

export interface LearningExample {
  ai_text: string;
  corrected_text: string;
  classification: string;
  created_at: string;
}

export interface WordChange {
  from: string[]; // display form of the AI's words (punctuation trimmed)
  to: string[]; // display form of the corrected words (punctuation trimmed)
}

export const MIN_OCCURRENCES = 2;
// A changed run longer than this is treated as a rewrite of the sentence, not
// a misread of specific words, and isn't learned as a pattern.
const MAX_PATTERN_WORDS = 3;
// Names can still be picked out of a slightly longer changed run.
const MAX_VOCAB_RUN_WORDS = 6;
const MIN_TERM_LENGTH = 3;

// Leading/trailing punctuation and quotes are ignored when comparing words, so
// "Eedanar," and "Eedanar" are the same word. Inner apostrophes and hyphens
// stay ("nothin'", "Half-Moon").
function displayForm(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(displayForm)
    .filter((t) => t.length > 0);
}

/** Word-level diff: the runs of words that differ between the AI's text and the correction. */
export function wordChanges(aiText: string, correctedText: string): WordChange[] {
  const a = tokenize(aiText);
  const b = tokenize(correctedText);
  const al = a.map((t) => t.toLowerCase());
  const bl = b.map((t) => t.toLowerCase());

  // Longest-common-subsequence table; segments are at most a few dozen words.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = al[i] === bl[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const changes: WordChange[] = [];
  let from: string[] = [];
  let to: string[] = [];
  const flush = () => {
    if (from.length || to.length) changes.push({ from, to });
    from = [];
    to = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && al[i] === bl[j]) {
      flush();
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      to.push(b[j++]);
    } else {
      from.push(a[i++]);
    }
  }
  flush();
  return changes;
}

// Common words that start sentences and would otherwise look like names.
const COMMON_WORDS = new Set(
  (
    "the a an and or but if then than so as at by for from in into of on onto to with without " +
    "he she it they we you i me him her them us his hers its their our your my mine " +
    "this that these those there here what when where who whom why how which " +
    "is was were be been being am are has have had do does did will would can could " +
    "shall should may might must not no yes oh ah ha hey well now just all any some " +
    "one two three four five six seven eight nine ten down up out over under after before " +
    "follow good great little big old new mr mrs ms sir captain king queen lord lady"
  ).split(" ")
);

/**
 * Recomputes the profile's tables from the full example history.
 * - correctionPatterns: short "misread -> corrected" word runs seen at least twice.
 * - vocabulary: names the user corrected the AI to at least twice. A term
 *   counts as a name if it is capitalized, isn't a common word, and is never
 *   written in lowercase anywhere in the user's corrected text.
 */
export function computeProfileTables(examples: LearningExample[]): {
  vocabulary: VocabularyEntry[];
  correctionPatterns: CorrectionPattern[];
} {
  const learnable = examples.filter((ex) => ex.classification === "handwriting_correction");

  const lowercaseSeen = new Set<string>();
  for (const ex of examples) {
    for (const t of tokenize(ex.corrected_text)) {
      if (t === t.toLowerCase()) lowercaseSeen.add(t);
    }
  }

  const patterns = new Map<string, CorrectionPattern>();
  const terms = new Map<string, { term: string; frequency: number }>();

  for (const ex of learnable) {
    for (const change of wordChanges(ex.ai_text, ex.corrected_text)) {
      if (
        change.from.length > 0 &&
        change.to.length > 0 &&
        change.from.length <= MAX_PATTERN_WORDS &&
        change.to.length <= MAX_PATTERN_WORDS
      ) {
        const fromPattern = change.from.join(" ");
        const toPattern = change.to.join(" ");
        const key = `${fromPattern.toLowerCase()}=>${toPattern.toLowerCase()}`;
        const existing = patterns.get(key);
        if (existing) {
          existing.occurrences += 1;
          if (ex.created_at > existing.lastConfirmedAt) existing.lastConfirmedAt = ex.created_at;
        } else {
          patterns.set(key, { fromPattern, toPattern, occurrences: 1, lastConfirmedAt: ex.created_at });
        }
      }

      if (change.to.length > 0 && change.to.length <= MAX_VOCAB_RUN_WORDS) {
        for (const word of change.to) {
          const lower = word.toLowerCase();
          if (word.length < MIN_TERM_LENGTH) continue;
          if (word[0] === lower[0]) continue; // not capitalized
          if (COMMON_WORDS.has(lower) || lowercaseSeen.has(lower)) continue;
          const entry = terms.get(lower);
          if (entry) entry.frequency += 1;
          else terms.set(lower, { term: word, frequency: 1 });
        }
      }
    }
  }

  const correctionPatterns = [...patterns.values()]
    .filter((p) => p.occurrences >= MIN_OCCURRENCES)
    .sort((x, y) => y.occurrences - x.occurrences || (x.lastConfirmedAt < y.lastConfirmedAt ? 1 : -1));

  const vocabulary = [...terms.values()]
    .filter((t) => t.frequency >= MIN_OCCURRENCES)
    .sort((x, y) => y.frequency - x.frequency);

  return { vocabulary, correctionPatterns };
}
