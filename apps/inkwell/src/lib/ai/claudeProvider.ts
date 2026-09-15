import { readFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prepareImageForVision } from "@/lib/imagePrep";
import { computeLineBasedRegions } from "./regionFromLines";
import type {
  AIProvider,
  GenerateTagsInput,
  GenerateTagsOutput,
  HandwritingContext,
  LearningEvalInput,
  LearningEvalOutput,
  TranscribeBatchInput,
  TranscribeBatchOutput,
  TranscribeInput,
  TranscribeOutput,
} from "./types";

// Real implementation of AIProvider, per Phase 2 Architecture §5.1: Claude is
// the default/primary AIProvider implementation, called with a distinct,
// narrowly-scoped prompt per method (never one shared mega-prompt), and
// structured/schema-validated output via tool-call mode (FR-14.4) rather
// than free-form prose. Per claude/08-walking-skeleton-scope.md this is
// built but not the default provider yet - MockAIProvider is, until an
// ANTHROPIC_API_KEY is supplied and the pipeline mechanics are proven.

// claude-opus-5 is the current flagship model (the previously-hardcoded
// "claude-sonnet-4-5" is a stale/invalid model ID and, separately, was never
// eligible for Claude's high-resolution vision tier). Accuracy on small,
// difficult cursive matters more than latency for this low-volume,
// single-user app, so we default to the strongest model rather than
// optimizing for speed/cost.
const MODEL = "claude-opus-5";

// Shared by TRANSCRIBE_TOOL (one page per call) and TRANSCRIBE_BATCH_TOOL
// (several pages per call) so the two schemas can't drift apart - a batch
// call is just "the same per-page shape, once per image, wrapped in pages[]".
const SEGMENT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    structureType: {
      type: "string",
      enum: ["paragraph", "heading", "list_item", "numbered_item", "dialogue", "table_cell", "line"],
    },
    crossedOut: { type: "boolean" },
    emphasis: { type: "string", enum: ["none", "underline", "bold_or_heavy"] },
    confidence: { type: "number", description: "0-1 self-reported confidence" },
    lineNumber: {
      type: "integer",
      description:
        "Which physical line of handwriting this segment sits on, counting from 1 at the top " +
        "of the page. Segments that are part of the same line of handwriting (e.g. \"the\" and " +
        "\"wizard\" within a line reading \"Met with the wizard\") must share the same lineNumber. " +
        "This only drives an approximate highlight region, not the transcription itself, so a " +
        "best-effort count is fine - omit it only for a segment you genuinely can't place on any " +
        "line (e.g. a stray mark).",
    },
  },
  required: ["text", "structureType", "crossedOut", "emphasis", "confidence"],
} as const;

const CONTENT_AREA_SCHEMA = {
  type: "object",
  description:
    "One whole-page judgment (not per segment) of roughly where the block of handwriting " +
    "sits vertically on the page, as 0-1 fractions of the full image height from the top. " +
    "Most pages are written on close to top-to-bottom, but when the writing only fills part " +
    "of the page - a short note with blank space below, for example - report that real " +
    "extent (e.g. top: 0.08, bottom: 0.3) rather than the whole page, so highlight regions " +
    "for the last few lines don't end up placed in the blank area below the actual writing. " +
    "Omit this field only if the writing genuinely fills the page top to bottom already.",
  properties: {
    top: { type: "number" },
    bottom: { type: "number" },
  },
  required: ["top", "bottom"],
} as const;

const TRANSCRIBE_TOOL: Anthropic.Tool = {
  name: "record_transcription",
  description:
    "Record the faithful transcription of a handwritten page, segment by segment, with a confidence score per segment.",
  input_schema: {
    type: "object",
    properties: {
      segments: { type: "array", items: SEGMENT_SCHEMA },
      pageLevelNotes: { type: "array", items: { type: "string" } },
      contentArea: CONTENT_AREA_SCHEMA,
    },
    required: ["segments"],
  },
};

// Batched sibling of TRANSCRIBE_TOOL: one message carries several page
// images, and this asks for one { segments, pageLevelNotes, contentArea }
// entry per image, in image order - see transcribeBatch() below for the
// rest of the batching design/rationale.
const TRANSCRIBE_BATCH_TOOL: Anthropic.Tool = {
  name: "record_transcription_batch",
  description:
    "Record the faithful transcription of each handwritten page image provided in this request, " +
    "in the same order as the images, one entry per image.",
  input_schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        description:
          "Exactly one entry per page image in this request, in the same order the images were " +
          "given (the first image's transcription is pages[0], and so on).",
        items: {
          type: "object",
          properties: {
            segments: { type: "array", items: SEGMENT_SCHEMA },
            pageLevelNotes: { type: "array", items: { type: "string" } },
            contentArea: CONTENT_AREA_SCHEMA,
          },
          required: ["segments"],
        },
      },
    },
    required: ["pages"],
  },
};

const EVALUATE_TOOL: Anthropic.Tool = {
  name: "record_evaluation",
  description: "Classify a single user correction to a transcribed segment.",
  input_schema: {
    type: "object",
    properties: {
      classification: {
        type: "string",
        enum: ["handwriting_correction", "content_edit", "rewrite", "formatting", "addition"],
      },
      learningWeight: { type: "number", description: "0-1" },
      rationale: { type: "string" },
    },
    required: ["classification", "learningWeight", "rationale"],
  },
};

const GENERATE_TAGS_TOOL: Anthropic.Tool = {
  name: "record_tags",
  description:
    "Propose a short list of tags for this note, strongly preferring the user's existing tag vocabulary over new near-duplicate tags.",
  input_schema: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            matchedExistingTag: {
              type: "boolean",
              description: "true if this exactly matches one of the provided existingUserTags",
            },
            confidence: { type: "number", description: "0-1" },
          },
          required: ["name", "matchedExistingTag", "confidence"],
        },
      },
    },
    required: ["tags"],
  },
};

// Shared prose between transcribe() and transcribeBatch() - identical
// transcription-quality bar either way, since batching only changes how many
// images/system-prompt copies go in one request, never the instructions
// themselves.
const TRANSCRIPTION_QUALITY_INSTRUCTIONS =
  "You transcribe handwritten page images faithfully and only. Reproduce exactly what is written: " +
  "do not correct grammar or spelling, do not summarize, do not add interpretation. Preserve structure " +
  "(paragraphs, headings, lists, dialogue) and mark crossed-out text and emphasis rather than omitting " +
  "or silently normalizing it. " +
  "IMPORTANT - crossed-out text: never mark crossedOut on a whole segment that also contains text that " +
  "was NOT crossed out, and never invent your own in-text notation (like strikethrough symbols, brackets, " +
  "or the words \"crossed out\") inside the transcribed text itself. Instead, split the crossed-out " +
  "word or phrase out into its own separate segment with crossedOut: true and only that struck-through " +
  "text as its content, and put the surrounding not-crossed-out text into their own separate " +
  "crossedOut: false segment(s) - the same way you would split out a single misread word. This keeps " +
  "every segment either entirely crossed-out or entirely not, so the app can render the distinction " +
  "instead of you describing it in prose. " +
  "Difficult or ambiguous cursive is expected - when a word is not clearly legible, do not guess a " +
  "different, fluent-sounding real word just because it fits the sentence grammatically or semantically. " +
  "A plausible invented word is a worse answer than an honest low-confidence best guess: transcribe your " +
  "best literal reading of the actual letter shapes, even if the result looks unusual or is not a " +
  "dictionary word, and drop your confidence score accordingly rather than silently substituting " +
  "something that reads more naturally. Confidence should reflect how certain you actually are that the " +
  "letters on the page say what you transcribed, not how natural the resulting sentence sounds. " +
  "For each segment, also report lineNumber - which physical line of handwriting it's on, " +
  "counting from 1 at the top of the page (not which sentence or paragraph - an actual visual " +
  "line as it appears on the page). Segments from the same line share the same number. Also " +
  "report contentArea once for the whole page - roughly where the block of handwriting starts " +
  "and ends vertically, which matters when the writing doesn't fill the whole page. Both are " +
  "used only to draw an approximate highlight region, never the transcription itself, so your " +
  "best estimate is fine - omit either one when you genuinely can't tell.";

function buildHandwritingHintText(hints: HandwritingContext): string {
  return hints.vocabularyHints.length || hints.correctionPatternHints.length
    ? [
        hints.vocabularyHints.length
          ? `Personal vocabulary this user writes often: ${hints.vocabularyHints.join(", ")}.`
          : null,
        hints.correctionPatternHints.length
          ? `This user's handwriting has previously been misread and corrected as follows - prefer the corrected form when the handwriting is ambiguous: ${hints.correctionPatternHints
              .map((h) => `"${h.fromPattern}" -> "${h.toPattern}"`)
              .join("; ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "No prior handwriting history for this user yet.";
}

type RawSegment = Omit<TranscribeOutput["segments"][number], "id" | "reviewRequired" | "sourceRegion"> & {
  lineNumber?: number;
};

// Shared by transcribe() and transcribeBatch(): turns one page's raw
// tool-call output (segments still carrying provider-only lineNumber, plus
// an optional contentArea) into the app's TranscribeOutput shape, computing
// regions rather than trusting any raw coordinates - see regionFromLines.ts.
function finishPageOutput(
  raw: { segments: RawSegment[]; pageLevelNotes?: string[]; contentArea?: { top: number; bottom: number } },
  confidenceThreshold: number
): TranscribeOutput {
  const regions = computeLineBasedRegions(raw.segments, raw.contentArea);
  return {
    pageLevelNotes: raw.pageLevelNotes,
    segments: raw.segments.map((s, i) => {
      const { lineNumber: _lineNumber, ...rest } = s;
      return {
        ...rest,
        id: crypto.randomUUID(),
        // reviewRequired is computed at the app-configured threshold, not
        // baked into the model call - see Phase 5 AI Contracts §1 notes.
        reviewRequired: s.confidence < confidenceThreshold,
        sourceRegion: regions[i],
      };
    }),
  };
}

async function loadImageForVision(
  imagePath: string
): Promise<{ buffer: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  const absolutePath = path.join(process.cwd(), "public", imagePath);
  const rawBytes = await readFile(absolutePath);
  // Auto-orient from EXIF and downscale to the vision model's
  // high-resolution-tier ceiling ourselves, with a high-quality resampler,
  // rather than letting the API auto-downscale a full uncropped photo - see
  // src/lib/imagePrep.ts for why this matters for small cursive.
  const { buffer, mediaType } = await prepareImageForVision(rawBytes);
  return { buffer, mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp" };
}

export class ClaudeAIProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    const { buffer: imageBytes, mediaType } = await loadImageForVision(input.imagePath);
    const hintText = buildHandwritingHintText(input.handwritingContext);

    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: TRANSCRIPTION_QUALITY_INSTRUCTIONS + " " + hintText,
      tools: [TRANSCRIBE_TOOL],
      tool_choice: { type: "tool", name: "record_transcription" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBytes.toString("base64"),
              },
            },
            { type: "text", text: "Transcribe this handwritten page." },
          ],
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a structured transcription (no tool_use block).");
    }

    const raw = toolUse.input as {
      segments: RawSegment[];
      pageLevelNotes?: string[];
      contentArea?: { top: number; bottom: number };
    };

    return finishPageOutput(raw, input.confidenceThreshold);
  }

  // Combines every page of a note into ONE API call instead of one per page
  // (the user asked for this after we discussed the token-cost tradeoff: see
  // TranscribeBatchInput's doc comment in types.ts). Concretely, this sends
  // one message with N images (each preceded by a "Page N of M" text label
  // so the model can't lose track of ordering) and asks for one transcription
  // per image back. What this saves: N-1 copies of the system prompt and
  // handwriting-context text that a per-page loop would otherwise resend.
  // What this does NOT save: image tokens themselves - Claude's vision
  // pricing tokenizes each image independently regardless of how many share
  // a request, so a 3-page note costs the same in image tokens whether sent
  // as 3 calls or 1. Falls back to the plain single-image transcribe() call
  // for a 1-page note, since there's no overhead to amortize and it keeps
  // that common case on the simpler, longer-proven code path.
  async transcribeBatch(input: TranscribeBatchInput): Promise<TranscribeBatchOutput> {
    if (input.pages.length === 0) return { pages: [] };
    if (input.pages.length === 1) {
      const only = input.pages[0];
      const result = await this.transcribe({
        imagePath: only.imagePath,
        handwritingContext: input.handwritingContext,
        confidenceThreshold: input.confidenceThreshold,
      });
      return { pages: [{ pageId: only.pageId, ...result }] };
    }

    const prepared = await Promise.all(
      input.pages.map(async (p) => ({ pageId: p.pageId, ...(await loadImageForVision(p.imagePath)) }))
    );
    const hintText = buildHandwritingHintText(input.handwritingContext);

    const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
    prepared.forEach((p, i) => {
      content.push({ type: "text", text: `Page ${i + 1} of ${prepared.length}:` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: p.mediaType, data: p.buffer.toString("base64") },
      });
    });
    content.push({
      type: "text",
      text:
        `Transcribe each of the ${prepared.length} handwritten page images above, in order - ` +
        `these are consecutive pages of one note. Return exactly ${prepared.length} entries in ` +
        `"pages", matching image order (pages[0] for the first image, and so on). Treat each page ` +
        "independently: do not merge, reorder, or carry segments across pages, even if the " +
        "handwriting continues a thought from the previous page.",
    });

    // max_tokens scales with page count (structured per-segment output for
    // several pages is proportionally larger than for one) but is capped -
    // Claude's max output tokens is a hard ceiling regardless of input size.
    const maxTokens = Math.min(4096 * prepared.length, 16384);

    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: TRANSCRIPTION_QUALITY_INSTRUCTIONS + " " + hintText,
      tools: [TRANSCRIBE_BATCH_TOOL],
      tool_choice: { type: "tool", name: "record_transcription_batch" },
      messages: [{ role: "user", content }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a structured transcription batch (no tool_use block).");
    }

    const raw = toolUse.input as {
      pages: Array<{
        segments: RawSegment[];
        pageLevelNotes?: string[];
        contentArea?: { top: number; bottom: number };
      }>;
    };

    if (raw.pages.length !== prepared.length) {
      throw new Error(
        `Claude returned ${raw.pages.length} page result(s) for a ${prepared.length}-image batch request.`
      );
    }

    return {
      pages: raw.pages.map((pageRaw, i) => ({
        pageId: prepared[i].pageId,
        ...finishPageOutput(pageRaw, input.confidenceThreshold),
      })),
    };
  }

  async evaluateHandwritingCorrection(input: LearningEvalInput): Promise<LearningEvalOutput> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "You classify a single edit a user made to an AI transcription of their own handwriting. " +
        "Distinguish a genuine handwriting misread (the AI guessed a different but visually similar word) " +
        "from a content edit (the user is correcting the meaning of what they wrote, not what the AI saw), " +
        "a rewrite, a formatting change, or an addition. Low-confidence classifications should still get a " +
        "small non-zero learning weight rather than 0.",
      tools: [EVALUATE_TOOL],
      tool_choice: { type: "tool", name: "record_evaluation" },
      messages: [
        {
          role: "user",
          content: `AI transcribed: "${input.aiText}"\nUser corrected to: "${input.correctedText}"\nAI's original confidence for this span: ${input.originalConfidence}`,
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a structured evaluation (no tool_use block).");
    }

    return toolUse.input as LearningEvalOutput;
  }

  async generateTags(input: GenerateTagsInput): Promise<GenerateTagsOutput> {
    const existingList = input.existingUserTags.length
      ? `This user's existing tags (reuse one of these verbatim whenever it reasonably applies, rather than proposing a near-duplicate - e.g. prefer their existing "D&D" over inventing "Dungeons & Dragons"): ${input.existingUserTags.join(", ")}.`
      : "This user has no existing tags yet.";

    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "You propose a short list (1-4) of concise topical tags for a handwritten note, based on its " +
        "transcription. Prefer reusing the user's existing tag vocabulary exactly (same spelling/casing) over " +
        "minting a new near-duplicate tag - only propose a new tag when no existing one reasonably applies. " +
        "Set matchedExistingTag to true only when `name` is an exact match to one of the provided existing " +
        "tags. Keep tags short (1-3 words), topical rather than generic (avoid vague tags like \"notes\" or " +
        "\"misc\"). " +
        existingList,
      tools: [GENERATE_TAGS_TOOL],
      tool_choice: { type: "tool", name: "record_tags" },
      messages: [
        {
          role: "user",
          content: `Note transcription:\n${input.transcription}`,
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return structured tags (no tool_use block).");
    }

    return toolUse.input as GenerateTagsOutput;
  }
}
