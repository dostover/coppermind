import { randomUUID } from "crypto";
import { GRID_COLS, GRID_ROWS, cellId, regionFromCells } from "./gridOverlay";
import type {
  AIProvider,
  GenerateTagsInput,
  GenerateTagsOutput,
  HandwritingContext,
  LearningEvalInput,
  LearningEvalOutput,
  SourceRegion,
  StructureType,
  TranscribeBatchInput,
  TranscribeBatchOutput,
  TranscribeInput,
  TranscribeOutput,
  TranscriptSegment,
} from "./types";

// Deterministic, no-network provider used as the default so the full
// pipeline (upload -> transcribe -> confidence -> review -> handwriting
// learning) can be validated without an API key. It does not look at the
// actual uploaded image; instead it cycles through fixed demo pages using
// the running "Rilldale / wizard / amulet" example from the source spec's
// own examples, with a handful of seeded misread words. When the supplied
// HandwritingContext already contains a learned correction for one of those
// words, the mock "gets it right" - simulating what a real vision model
// conditioned on the user's HandwritingProfile should do over time.
//
// Segments are deliberately word/phrase-granular rather than whole-sentence:
// FR-4.4 asks for confidence at "a sub-document granularity (e.g., per
// word/phrase/span), not only a single document-level score", and the
// Phase 5 AI Contracts doc says corrections are "diffed at the
// TranscriptSegment level" - i.e. the segment IS the atomic correction
// unit. A misread word sharing a segment with several clean words would
// get diffed as one whole-phrase change, which a real classifier (and this
// mock) would score as a low-weight content edit rather than the
// high-weight handwriting correction it actually is. See the review
// history on this file: an earlier whole-sentence-segment version of this
// mock reproduced exactly that failure.
//
// This validates pipeline mechanics, not real OCR accuracy - see
// claude/07-prototype-notes.md for the equivalent design in the earlier
// FastAPI spike, and claude/08-walking-skeleton-scope.md for why this
// walking skeleton starts here rather than on real transcription.

type DemoSegment =
  | { kind: "text"; text: string; structureType: StructureType; startsNewBlock: boolean }
  | { kind: "word"; wrong: string; right: string; structureType: StructureType; startsNewBlock: boolean };

// startsNewBlock defaults to true - most text() calls in the demo pages below
// are their own sentence-initial thought, same as before this field existed.
// Pass false explicitly for a segment that continues the *same* paragraph/
// list as the one before it (a later sentence in an ongoing paragraph), same
// as a real transcription would report for such a segment.
function text(t: string, structureType: StructureType = "paragraph", startsNewBlock = true): DemoSegment {
  return { kind: "text", text: t, structureType, startsNewBlock };
}

// A misread word carved out of the middle of a sentence purely to score its
// own confidence (see this file's top comment) is by definition never a
// fresh structural block - it's always a continuation of whatever paragraph/
// list item the surrounding text belongs to.
function word(wrong: string, right: string): DemoSegment {
  return { kind: "word", wrong, right, structureType: "paragraph", startsNewBlock: false };
}

// Each page below deliberately exercises a heading, a multi-sentence
// paragraph (proving sentences don't each need their own paragraph break),
// an actual paragraph break, and a list (bulleted or numbered) - the full
// "core four" structure types the review screen now renders distinctly and
// lets the user reclassify - rather than the single flattened paragraph
// every demo page was before startsNewBlock existed, which meant this
// structure-editing feature had nothing real to render against.
const DEMO_PAGES: DemoSegment[][] = [
  [
    text("Notes on the Rilldale expedition", "heading"),
    text("Met with the"),
    word("wizzard", "wizard"),
    text("near the old", "paragraph", false),
    word("watchtowfr", "watchtower"),
    text("today.", "paragraph", false),
    text("He warned me about the", "paragraph", false),
    word("amvlet", "amulet"),
    text("again.", "paragraph", false),
    text("Things to check next visit:"),
    text("Whether the amulet is truly cursed", "list_item"),
    text("Who else knows about the watchtower", "list_item"),
    text("If the elders will finally talk", "list_item"),
    text("I'm not sure if I believe him, but the village elders seem worried."),
  ],
  [
    text("Returned to"),
    word("Rilldaie", "Rilldale"),
    text("this morning to ask more questions.", "paragraph", false),
    text("The", "paragraph", false),
    word("wizzard", "wizard"),
    text("says the", "paragraph", false),
    word("amvlet", "amulet"),
    text("must be hidden before the solstice.", "paragraph", false),
    text("No sign of the"),
    word("watchtowfr", "watchtower"),
    text("guards yet.", "paragraph", false),
    text("Preparations before we head back:"),
    text("Pack extra torches", "numbered_item"),
    text("Warn the village elders", "numbered_item"),
  ],
  [
    text("Third trip to"),
    word("Rilldaie", "Rilldale"),
    text("- the", "paragraph", false),
    word("wizzard", "wizard"),
    text("finally showed me the", "paragraph", false),
    word("amvlet", "amulet"),
    text(".", "paragraph", false),
    text("It glows faintly near the"),
    word("watchtowfr", "watchtower"),
    text("at dusk.", "paragraph", false),
    text("Loose ends:"),
    text("Ask why it only glows after dark", "list_item"),
    text("Find out who built the watchtower", "list_item"),
  ],
];

// Fake but plausible per-segment region, spreading segments down the page
// in reading order (one row per segment, wrapping columns if there are more
// segments than rows) - just enough for the review UI's highlight-on-focus
// behavior to be exercised without a real API key. Reuses gridOverlay.ts's
// own cell-id/region helpers so the mock and real providers describe
// locations the same way.
function mockRegion(index: number, total: number): SourceRegion | undefined {
  if (total === 0) return undefined;
  const row = index % GRID_ROWS;
  const col = Math.floor((index / GRID_ROWS) % GRID_COLS);
  return regionFromCells([cellId(col, row)]);
}

function hashToIndex(input: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % mod;
}

function resolveSegment(
  demo: DemoSegment,
  hints: { fromPattern: string; toPattern: string }[]
): { text: string; confidence: number } {
  if (demo.kind === "text") {
    return { text: demo.text, confidence: 0.92 + Math.random() * 0.06 };
  }
  const learned = hints.some((h) => h.fromPattern.toLowerCase() === demo.wrong.toLowerCase());
  return {
    text: learned ? demo.right : demo.wrong,
    confidence: learned ? 0.94 + Math.random() * 0.04 : 0.4 + Math.random() * 0.15,
  };
}

export class MockAIProvider implements AIProvider {
  // Shared by transcribe() and transcribeBatch() - the mock's per-page logic
  // never actually depends on being called individually vs. in a batch (it
  // doesn't make a network call either way), so both just call this once per
  // page. Kept private/sync since there's no real async work to await.
  private buildPageOutput(imagePath: string, handwritingContext: HandwritingContext, confidenceThreshold: number): TranscribeOutput {
    const pageIndex = hashToIndex(imagePath, DEMO_PAGES.length);
    const page = DEMO_PAGES[pageIndex];

    const segments: TranscriptSegment[] = page.map((demo, index) => {
      const { text: resolvedText, confidence } = resolveSegment(
        demo,
        handwritingContext.correctionPatternHints
      );
      return {
        id: randomUUID(),
        text: resolvedText,
        structureType: demo.structureType,
        startsNewBlock: demo.startsNewBlock,
        crossedOut: false,
        emphasis: demo.structureType === "heading" ? "bold_or_heavy" : "none",
        confidence,
        reviewRequired: confidence < confidenceThreshold,
        sourceRegion: mockRegion(index, page.length),
      };
    });

    return {
      segments,
      pageLevelNotes: ["Mock provider - demo content, not derived from the uploaded image."],
    };
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    return this.buildPageOutput(input.imagePath, input.handwritingContext, input.confidenceThreshold);
  }

  // Mirrors ClaudeAIProvider.transcribeBatch's contract (one result per input
  // page, matched by pageId) without any real batching benefit to simulate -
  // this just proves the jobs.ts/db.ts plumbing around a note-level batch job
  // works end to end without needing an API key.
  async transcribeBatch(input: TranscribeBatchInput): Promise<TranscribeBatchOutput> {
    return {
      pages: input.pages.map(({ pageId, imagePath }) => ({
        pageId,
        ...this.buildPageOutput(imagePath, input.handwritingContext, input.confidenceThreshold),
      })),
    };
  }

  async evaluateHandwritingCorrection(
    input: LearningEvalInput
  ): Promise<LearningEvalOutput> {
    const a = input.aiText.trim();
    const b = input.correctedText.trim();

    if (a === b) {
      return { classification: "formatting", learningWeight: 0, rationale: "No change." };
    }

    const wordsA = a.split(/\s+/).filter(Boolean);
    const wordsB = b.split(/\s+/).filter(Boolean);
    const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length, 1);

    if (wordsA.length === wordsB.length && wordsA.length <= 3 && lengthRatio > 0.5) {
      return {
        classification: "handwriting_correction",
        learningWeight: 0.85,
        rationale: "Similar-length, same-word-count change - looks like a misread word fixed.",
      };
    }

    if (b.length > a.length * 1.5) {
      return {
        classification: "addition",
        learningWeight: 0.2,
        rationale: "Corrected text is substantially longer - looks like added content.",
      };
    }

    if (wordsA.length === wordsB.length && wordsA.length > 3) {
      return {
        classification: "content_edit",
        learningWeight: 0.15,
        rationale: "Same word count but longer text - looks like a factual/content change, not a misread.",
      };
    }

    return {
      classification: "rewrite",
      learningWeight: 0.1,
      rationale: "Structurally different from the original - low-confidence fallback classification.",
    };
  }

  // Simplistic keyword match against the mock's own fixed demo vocabulary
  // (see DEMO_PAGES above) rather than real topic extraction - this proves
  // the generateTags plumbing (reuse-existing-tag matching, AC-9) end to end
  // without a network call, the same spirit as the rest of this file.
  // Matches on both the "right" and (still-unlearned) "wrong" spellings from
  // DEMO_PAGES, since the transcription text this actually runs against is
  // whatever the mock transcriber produced - which may still be the
  // misread form early on.
  async generateTags(input: GenerateTagsInput): Promise<GenerateTagsOutput> {
    const KEYWORDS: { tag: string; variants: string[] }[] = [
      { tag: "Rilldale", variants: ["rilldale", "rilldaie"] },
      { tag: "wizard", variants: ["wizard", "wizzard"] },
      { tag: "amulet", variants: ["amulet", "amvlet"] },
      { tag: "watchtower", variants: ["watchtower", "watchtowfr"] },
      { tag: "expedition", variants: ["expedition"] },
    ];
    const lowerText = input.transcription.toLowerCase();
    const found = KEYWORDS.filter((k) => k.variants.some((v) => lowerText.includes(v))).map(
      (k) => k.tag
    );

    const tags = found.map((keyword) => {
      const existing = input.existingUserTags.find(
        (t) => t.toLowerCase() === keyword.toLowerCase()
      );
      return {
        name: existing ?? keyword,
        matchedExistingTag: Boolean(existing),
        confidence: 0.7 + Math.random() * 0.2,
      };
    });

    return { tags };
  }
}
