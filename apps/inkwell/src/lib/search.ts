import { notesRepo, searchIndexRepo, type IndexedChunkRow, type Note } from "./db";
import { STOPWORDS, cosine, getEmbeddingProvider } from "./embeddings";

// Hybrid search over the Library (02-architecture.md §7, FR-10.1-10.6): three
// independent retrievers, fused by Reciprocal Rank Fusion (RRF) so no single
// signal decides alone - not vector similarity alone (FR-10.6):
//
//   1. exact text  - the original substring match over title + text, so
//                    partial words ("wizz") and exact phrases still hit.
//   2. keyword     - SQLite FTS5 over indexed chunks, BM25-ranked, stemmed
//                    ("blessing" finds "blessings").
//   3. meaning     - cosine similarity between the query's embedding and every
//                    chunk's embedding ("forgiveness" finds a passage about
//                    "grace covers all your sin").
//
// RRF is rank-based (score = sum of 1/(K + rank) across retrievers), which
// sidesteps the problem that BM25 scores, cosine similarities and "matched
// or not" live on unrelated scales.

const RRF_K = 60;
const CHUNKS_PER_RETRIEVER = 40;
const MAX_RESULTS = 25;

// Cosine floor for a "meaning" hit to count at all - without one, every
// query would return the whole library, just in some order. Voyage vectors
// for genuinely unrelated text typically score well below this; related
// passages well above. Tunable via SEMANTIC_MIN_SCORE if results turn out
// too loose or too strict on real notes. The mock embedder (no
// VOYAGE_API_KEY) scores only shared words, so it uses a lower floor.
const SEMANTIC_MIN_SCORE = Number(process.env.SEMANTIC_MIN_SCORE) || 0.3;
const MOCK_SEMANTIC_MIN_SCORE = 0.15;

export type MatchKind = "exact" | "keyword" | "meaning";

export interface SearchHit {
  note: Note;
  /** Best passage to show under the result (from the strongest retriever). */
  snippet: string;
  /** Which retrievers found this note - drives the "why it matched" label. */
  matchedBy: MatchKind[];
  score: number;
}

export interface RetrievedChunk extends IndexedChunkRow {
  /** Rank-fused score across keyword + meaning retrieval. */
  score: number;
}

// Turns free text into a safe FTS5 query: each word becomes a quoted term
// (so FTS syntax characters in user input can't throw), OR-joined so a note
// matching some of the words still ranks - BM25 already rewards matching
// more of them. Prefix-matches the last word so search-as-you-type works.
// Words that carry no search meaning on their own - common English
// function words, plus the phrasing people use when asking about their
// notes ("what do my notes say about..."). Without this, OR-matching let
// "What does my note say about forgiveness?" rank a note just for
// containing "notes" and "about", and let an unrelated question match
// everything through "is", "the", "of".
const QUERY_FILLER = new Set([
  ...STOPWORDS,
  ..."is it in on at to of a an as be do my me i we us so if or by up no yes say says said tell note notes wrote written write mention mentioned anything something any some".split(" "),
]);

/** The words of a query that actually matter for matching/highlighting
 *  (filler removed); falls back to all words if that leaves nothing. */
export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const meaningful = words.filter((w) => w.length > 1 && !QUERY_FILLER.has(w));
  return meaningful.length ? meaningful : words.filter((w) => w.length > 1);
}

function toFtsQuery(query: string): string | null {
  // All filler (e.g. "what is it"): queryTerms falls back to the raw words
  // rather than matching nothing.
  const terms = queryTerms(query).map((w) => `"${w.replace(/"/g, "")}"`);
  if (terms.length === 0) return null;
  terms[terms.length - 1] += "*";
  return terms.join(" OR ");
}

async function semanticChunks(query: string, folderId?: string | null): Promise<(IndexedChunkRow & { similarity: number })[]> {
  const provider = getEmbeddingProvider();
  const vectors = searchIndexRepo.listActiveVectors(provider.modelId, folderId);
  if (vectors.length === 0) return [];
  const [q] = await provider.embed([query], "query");
  const floor = provider.modelId.startsWith("mock:") ? MOCK_SEMANTIC_MIN_SCORE : SEMANTIC_MIN_SCORE;
  return vectors
    .map(({ embedding, ...row }) => ({ ...row, similarity: cosine(q, embedding) }))
    .filter((r) => r.similarity >= floor)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, CHUNKS_PER_RETRIEVER);
}

function keywordChunks(query: string, folderId?: string | null): IndexedChunkRow[] {
  const match = toFtsQuery(query);
  if (!match) return [];
  try {
    return searchIndexRepo.keywordSearch(match, CHUNKS_PER_RETRIEVER, folderId);
  } catch (err) {
    console.error("Keyword search failed (falling back to other retrievers):", err);
    return [];
  }
}

// Meaning search needs the embeddings API; if it's down, search degrades to
// words-only rather than failing outright.
async function safeSemanticChunks(query: string, folderId?: string | null) {
  try {
    return await semanticChunks(query, folderId);
  } catch (err) {
    console.error("Semantic search failed (falling back to keyword search):", err);
    return [];
  }
}

/** Library search: notes ranked by fused relevance, each with its best
 *  matching passage and which kinds of match found it. */
export async function searchNotes(query: string, folderId?: string | null): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [semantic, keyword] = await Promise.all([
    safeSemanticChunks(trimmed, folderId),
    Promise.resolve(keywordChunks(trimmed, folderId)),
  ]);
  const exactNotes = notesRepo.listAll(trimmed, folderId);

  const byNote = new Map<string, { score: number; matchedBy: Set<MatchKind>; snippet?: string; snippetFrom?: MatchKind }>();
  const entry = (noteId: string) => {
    let e = byNote.get(noteId);
    if (!e) byNote.set(noteId, (e = { score: 0, matchedBy: new Set() }));
    return e;
  };
  // Each retriever contributes a note once, at the rank of its best chunk.
  const addRanked = (noteIds: string[], kind: MatchKind, snippets?: Map<string, string>) => {
    const seen = new Set<string>();
    let rank = 0;
    for (const noteId of noteIds) {
      if (seen.has(noteId)) continue;
      seen.add(noteId);
      rank++;
      const e = entry(noteId);
      e.score += 1 / (RRF_K + rank);
      e.matchedBy.add(kind);
      // Snippet preference: a keyword passage (it contains the words) over
      // a meaning passage; exact matches get their snippet from the page's
      // own highlighter instead.
      const snippet = snippets?.get(noteId);
      if (snippet && (!e.snippet || (e.snippetFrom === "meaning" && kind === "keyword"))) {
        e.snippet = snippet;
        e.snippetFrom = kind;
      }
    }
  };

  const firstChunkText = (rows: IndexedChunkRow[]) => {
    const m = new Map<string, string>();
    for (const r of rows) if (!m.has(r.note_id)) m.set(r.note_id, r.text);
    return m;
  };

  addRanked(exactNotes.map((n) => n.id), "exact");
  addRanked(keyword.map((r) => r.note_id), "keyword", firstChunkText(keyword));
  addRanked(semantic.map((r) => r.note_id), "meaning", firstChunkText(semantic));

  const hits: SearchHit[] = [];
  for (const [noteId, e] of byNote) {
    const note = notesRepo.getById(noteId);
    if (!note || note.deleted_at) continue;
    hits.push({
      note,
      snippet: e.snippet ?? note.segmentsCurrent.map((s) => s.text).join(" "),
      matchedBy: (["exact", "keyword", "meaning"] as MatchKind[]).filter((k) => e.matchedBy.has(k)),
      score: e.score,
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

/** Passages to answer a question from: keyword + meaning retrieval over
 *  chunks (not whole notes - a question is usually answered by one or two
 *  passages, and handing Claude only those keeps answers focused and cheap),
 *  rank-fused the same way as searchNotes. */
export async function retrieveChunksForQuestion(question: string, limit = 8): Promise<RetrievedChunk[]> {
  const [semantic, keyword] = await Promise.all([
    safeSemanticChunks(question),
    Promise.resolve(keywordChunks(question)),
  ]);
  const byChunk = new Map<string, RetrievedChunk>();
  const add = (rows: IndexedChunkRow[]) =>
    rows.forEach((row, i) => {
      const existing = byChunk.get(row.id);
      const bump = 1 / (RRF_K + i + 1);
      if (existing) existing.score += bump;
      else
        byChunk.set(row.id, {
          id: row.id,
          note_id: row.note_id,
          chunk_index: row.chunk_index,
          page_number: row.page_number,
          text: row.text,
          score: bump,
        });
    });
  add(semantic);
  add(keyword);
  return [...byChunk.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// Library search box: treat input as a question (and ask for an answer)
// when it reads like one - ends in "?" or opens with a question word.
// Anything else is just a search. The page also offers an explicit "Ask"
// button, so a misclassified query is one click from the other mode.
const QUESTION_START =
  /^(who|what|when|where|why|how|which|whose|whom|is|are|was|were|do|does|did|can|could|should|would|will|has|have|had|summari[sz]e|explain|tell me|list|compare)\b/i;

export function looksLikeQuestion(query: string): boolean {
  const q = query.trim();
  return q.endsWith("?") || (QUESTION_START.test(q) && q.split(/\s+/).length >= 3);
}
