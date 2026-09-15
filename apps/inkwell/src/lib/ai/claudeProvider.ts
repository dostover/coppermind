import { readFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prepareImageForVision } from "@/lib/imagePrep";
import type {
  AIProvider,
  GenerateTagsInput,
  GenerateTagsOutput,
  LearningEvalInput,
  LearningEvalOutput,
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

const TRANSCRIBE_TOOL: Anthropic.Tool = {
  name: "record_transcription",
  description:
    "Record the faithful transcription of a handwritten page, segment by segment, with a confidence score per segment.",
  input_schema: {
    type: "object",
    properties: {
      segments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            structureType: {
              type: "string",
              enum: [
                "paragraph",
                "heading",
                "list_item",
                "numbered_item",
                "dialogue",
                "table_cell",
                "line",
              ],
            },
            crossedOut: { type: "boolean" },
            emphasis: { type: "string", enum: ["none", "underline", "bold_or_heavy"] },
            confidence: { type: "number", description: "0-1 self-reported confidence" },
            sourceRegion: {
              type: "object",
              description:
                "Best-effort bounding box for where this segment appears on the page, as fractions " +
                "(0-1) of the full image's width/height measured from the top-left corner. Omit this " +
                "field entirely for a segment you cannot confidently localize - a missing region is " +
                "expected and fine, never guess one just to fill the field.",
              properties: {
                bbox: {
                  type: "array",
                  description: "[x, y, width, height], each 0-1",
                  items: { type: "number" },
                  minItems: 4,
                  maxItems: 4,
                },
              },
              required: ["bbox"],
            },
          },
          required: ["text", "structureType", "crossedOut", "emphasis", "confidence"],
        },
      },
      pageLevelNotes: { type: "array", items: { type: "string" } },
    },
    required: ["segments"],
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

export class ClaudeAIProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    const absolutePath = path.join(process.cwd(), "public", input.imagePath);
    const rawBytes = await readFile(absolutePath);
    // Auto-orient from EXIF and downscale to the vision model's
    // high-resolution-tier ceiling ourselves, with a high-quality resampler,
    // rather than letting the API auto-downscale a full uncropped photo -
    // see src/lib/imagePrep.ts for why this matters for small cursive.
    const { buffer: imageBytes, mediaType } = await prepareImageForVision(rawBytes);

    const hints = input.handwritingContext;
    const hintText =
      hints.vocabularyHints.length || hints.correctionPatternHints.length
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

    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system:
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
        "For each segment, also report sourceRegion when you can confidently tell where it sits on the " +
        "page - a bounding box as 0-1 fractions of the full image, from the top-left. This only needs " +
        "to be roughly right (line-level precision is fine, word-perfect is not required); omit the " +
        "field entirely rather than guessing when you're not confident where a segment is. " +
        hintText,
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
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
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
      segments: Array<Omit<TranscribeOutput["segments"][number], "id" | "reviewRequired">>;
      pageLevelNotes?: string[];
    };

    return {
      pageLevelNotes: raw.pageLevelNotes,
      segments: raw.segments.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        // reviewRequired is computed at the app-configured threshold, not
        // baked into the model call - see Phase 5 AI Contracts §1 notes.
        reviewRequired: s.confidence < input.confidenceThreshold,
        // Normalize an omitted field to null rather than undefined, so
        // downstream code (and the JSON round-trip through db.ts) sees one
        // consistent "no region" representation.
        sourceRegion: s.sourceRegion ?? null,
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
