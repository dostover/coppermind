import { randomUUID } from "crypto";
import type {
  AIProvider,
  GenerateTagsInput,
  GenerateTagsOutput,
  LearningEvalInput,
  LearningEvalOutput,
  StructureType,
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
  | { kind: "text"; text: string; structureType: StructureType }
  | { kind: "word"; wrong: string; right: string; structureType: StructureType };

function text(t: string, structureType: StructureType = "paragraph"): DemoSegment {
  return { kind: "text", text: t, structureType };
}

function word(wrong: string, right: string): DemoSegment {
  return { kind: "word", wrong, right, structureType: "paragraph" };
}

const DEMO_PAGES: DemoSegment[][] = [
  [
    text("Notes on the Rilldale expedition", "heading"),
    text("Met with the"),
    word("wizzard", "wizard"),
    text("near the old"),
    word("watchtowfr", "watchtower"),
    text("today."),
    text("He warned me about the"),
    word("amvlet", "amulet"),
    text("again."),
    text("I'm not sure if I believe him, but the village elders seem worried."),
  ],
  [
    text("Returned to"),
    word("Rilldaie", "Rilldale"),
    text("this morning to ask more questions."),
    text("The"),
    word("wizzard", "wizard"),
    text("says the"),
    word("amvlet", "amulet"),
    text("must be hidden before the solstice."),
    text("No sign of the"),
    word("watchtowfr", "watchtower"),
    text("guards yet."),
  ],
  [
    text("Third trip to"),
    word("Rilldaie", "Rilldale"),
    text("- the"),
    word("wizzard", "wizard"),
    text("finally showed me the"),
    word("amvlet", "amulet"),
    text("."),
    text("It glows faintly near the"),
    word("watchtowfr", "watchtower"),
    text("at dusk."),
  ],
];

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

// Fabricates a plausible-looking region per segment, evenly stacked down the
// page in reading order. This mock never looks at the real uploaded image
// (see file header), so these boxes don't correspond to actual handwriting -
// they exist to exercise the review screen's highlight-on-select mechanism
// (does the right box appear, does it move when you focus a different
// segment) without needing a live model call. Width is loosely scaled by
// text length purely so short and long segments don't render as identical
// boxes; none of this should be read as a real localization heuristic.
function mockRegion(index: number, total: number, textLength: number): TranscriptSegment["sourceRegion"] {
  const top = 0.06 + (index / Math.max(total - 1, 1)) * 0.86;
  const width = Math.min(0.85, Math.max(0.12, textLength * 0.018));
  return { bbox: [0.08, top, width, 0.035] };
}

export class MockAIProvider implements AIProvider {
  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    const pageIndex = hashToIndex(input.imagePath, DEMO_PAGES.length);
    const page = DEMO_PAGES[pageIndex];

    const segments: TranscriptSegment[] = page.map((demo, index) => {
      const { text: resolvedText, confidence } = resolveSegment(
        demo,
        input.handwritingContext.correctionPatternHints
      );
      return {
        id: randomUUID(),
        text: resolvedText,
        structureType: demo.structureType,
        crossedOut: false,
        emphasis: demo.structureType === "heading" ? "bold_or_heavy" : "none",
        confidence,
        reviewRequired: confidence < input.confidenceThreshold,
        sourceRegion: mockRegion(index, page.length, resolvedText.length),
      };
    });

    return {
      segments,
      pageLevelNotes: ["Mock provider - demo content, not derived from the uploaded image."],
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
