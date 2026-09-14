import { readFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
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

const MODEL = "claude-sonnet-4-5";

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

function mimeTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export class ClaudeAIProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    const absolutePath = path.join(process.cwd(), "public", input.imagePath);
    const imageBytes = await readFile(absolutePath);
    const mediaType = mimeTypeFor(absolutePath);

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
        "or silently normalizing it. Report your own genuine per-segment confidence (0-1); do not inflate it. " +
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
}
