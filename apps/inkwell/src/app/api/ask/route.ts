import { NextRequest, NextResponse } from "next/server";
import { notesRepo } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { retrieveChunksForQuestion } from "@/lib/search";

// Ask a question of the whole library (FR-10.4): retrieve the most relevant
// passages (search.ts), then have the AI answer from those passages only,
// citing them. Every response carries its sources, so the UI always shows
// the underlying notes alongside the answer, never the answer alone (§22).
//
// No passages -> a "nothing found" answer without calling the model at all
// (05-ai-contracts.md §8): an answer with no grounding is exactly what this
// feature must never produce.

const MAX_QUESTION_LENGTH = 1000;

export interface AskSource {
  sourceNumber: number;
  noteId: string;
  noteTitle: string;
  pageNumber: number;
  text: string;
  cited: boolean;
}

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = (await req.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "That question is too long." }, { status: 400 });
  }

  const chunks = await retrieveChunksForQuestion(question);
  const sources = chunks.flatMap((chunk, i) => {
    const note = notesRepo.getById(chunk.note_id);
    if (!note) return [];
    return [
      {
        sourceNumber: i + 1,
        noteId: note.id,
        noteTitle: note.title ?? "Untitled note",
        noteDate: new Date(note.created_at).toLocaleDateString("en-US", { dateStyle: "medium" }),
        pageNumber: chunk.page_number,
        text: chunk.text,
      },
    ];
  });

  if (sources.length === 0) {
    return NextResponse.json({
      answer: "I couldn't find anything in your notes about that.",
      confidence: "not_found",
      sources: [],
    });
  }

  try {
    const result = await getAIProvider().answerQuestion({ question, sources });
    const valid = new Set(sources.map((s) => s.sourceNumber));
    const cited = new Set(result.citedSources.filter((n) => valid.has(n)));
    // Also count any [n] the prose itself uses, in case citedSources missed one.
    for (const m of result.answer.matchAll(/\[(\d+)\]/g)) {
      const n = Number(m[1]);
      if (valid.has(n)) cited.add(n);
    }
    const payload: AskSource[] = sources.map(({ noteDate: _noteDate, ...s }) => ({
      ...s,
      cited: cited.has(s.sourceNumber),
    }));
    return NextResponse.json({ answer: result.answer, confidence: result.confidence, sources: payload });
  } catch (err) {
    console.error("Answering failed:", err);
    return NextResponse.json(
      { error: "Couldn't get an answer right now - the matching notes are listed below." },
      { status: 502 }
    );
  }
}
