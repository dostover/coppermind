"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// The "answer" half of the Library's smart search box: when the query reads
// like a question (or the user hits Ask), this panel asks POST /api/ask and
// shows a short answer grounded in the user's notes, with numbered citations
// and the passages they point to. The regular search results still render
// underneath it on the page - the answer never replaces the notes (§22).

interface Source {
  sourceNumber: number;
  noteId: string;
  noteTitle: string;
  pageNumber: number;
  text: string;
  cited: boolean;
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; answer: string; confidence: "high" | "low" | "not_found"; sources: Source[] };

// Turns inline [n] markers into small links to the matching source below.
function renderAnswer(answer: string, sources: Source[]): ReactNode[] {
  const valid = new Set(sources.map((s) => s.sourceNumber));
  return answer.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m && valid.has(Number(m[1]))) {
      return (
        <a key={i} href={`#ask-source-${m[1]}`} className="citation">
          {m[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function excerpt(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export function AskAnswer({ question }: { question: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setState({ kind: "error", message: json.error ?? "Couldn't get an answer right now." });
        else setState({ kind: "done", answer: json.answer, confidence: json.confidence, sources: json.sources ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "Couldn't reach the server to get an answer." });
      });
    return () => {
      cancelled = true;
    };
  }, [question]);

  if (state.kind === "loading") {
    return (
      <div className="card ask-answer" role="status" aria-live="polite">
        <p className="ask-label">Answer from your notes</p>
        <p className="muted" style={{ margin: 0 }}>
          Reading your notes…
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="card ask-answer" role="alert">
        <p className="ask-label">Answer from your notes</p>
        <p className="muted" style={{ margin: 0 }}>
          {state.message}
        </p>
      </div>
    );
  }

  const cited = state.sources.filter((s) => s.cited);
  return (
    <div className={`card ask-answer${state.confidence === "not_found" ? " not-found" : ""}`} aria-live="polite">
      <p className="ask-label">
        Answer from your notes
        {state.confidence === "low" && <span className="muted"> · partial match</span>}
      </p>
      <p className="ask-text">{renderAnswer(state.answer, state.sources)}</p>
      {cited.length > 0 && (
        <ol className="ask-sources">
          {cited.map((s) => (
            <li key={s.sourceNumber} id={`ask-source-${s.sourceNumber}`} value={s.sourceNumber}>
              <Link href={`/notes/${s.noteId}`}>
                <strong>{s.noteTitle}</strong>
                {s.pageNumber > 1 ? <span className="muted"> · page {s.pageNumber}</span> : null}
              </Link>
              <p className="muted">“{excerpt(s.text)}”</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
