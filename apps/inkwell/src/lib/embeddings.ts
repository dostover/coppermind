// Embedding providers - turn text into vectors for "search by meaning" and
// for retrieving the passages a question gets answered from (see search.ts).
//
// Kept separate from AIProvider (src/lib/ai/) per 02-architecture.md's
// `EmbeddingProvider` interface: Claude doesn't offer an embeddings API, so
// this is a distinct capability backed by a different provider.
//
// Same config-driven "unset = mock, not an error" pattern as the AI
// provider: VOYAGE_API_KEY set -> Voyage AI; unset -> MockEmbeddingProvider,
// a deterministic word-hashing stand-in so indexing, search and the tests
// all run with no key and no network. The mock only matches shared words,
// never meaning - the Library says so while it's in use (see
// SEMANTIC_SEARCH_CONFIGURED).

export type EmbeddingInputType = "document" | "query";

export interface EmbeddingProvider {
  /** Stored alongside every vector, so switching models (or adding a key
   *  later) is detected and the library gets re-embedded - vectors from two
   *  different models aren't comparable. */
  readonly modelId: string;
  embed(texts: string[], inputType: EmbeddingInputType): Promise<Float32Array[]>;
}

export const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? "";
// voyage-4: Voyage's general-purpose model (1024-dim by default). Override
// with VOYAGE_MODEL (e.g. voyage-4-lite for cheaper, voyage-4-large for
// better) - changing it triggers a full re-embed on the next server start.
export const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-4";
export const SEMANTIC_SEARCH_CONFIGURED = Boolean(VOYAGE_API_KEY);

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
// Well under Voyage's per-request limits (1000 inputs; 320K tokens for
// voyage-4) given our chunks are ~120 words each.
const VOYAGE_BATCH_SIZE = 128;

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;

  constructor(
    private readonly apiKey: string,
    model: string
  ) {
    this.modelId = `voyage:${model}`;
  }

  async embed(texts: string[], inputType: EmbeddingInputType): Promise<Float32Array[]> {
    const model = this.modelId.slice("voyage:".length);
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
      const batch = texts.slice(i, i + VOYAGE_BATCH_SIZE);
      const res = await fetch(VOYAGE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        // input_type tells Voyage whether this is a stored passage or a
        // search query - it prepends a retrieval prompt for each, which
        // measurably improves query->passage matching.
        body: JSON.stringify({ input: batch, model, input_type: inputType }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Voyage embeddings request failed (${res.status}): ${detail.slice(0, 300) || res.statusText}`);
      }
      const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
      const ordered = [...json.data].sort((a, b) => a.index - b.index);
      if (ordered.length !== batch.length) {
        throw new Error(`Voyage returned ${ordered.length} embeddings for ${batch.length} inputs.`);
      }
      for (const item of ordered) out.push(normalize(Float32Array.from(item.embedding)));
    }
    return out;
  }
}

// Feature-hashed bag of words (with light suffix stripping so "blessing"
// and "blessings" land together). Deterministic, offline, and honest about
// what it is: keyword overlap dressed as a vector, good enough to exercise
// the whole pipeline without a key.
const MOCK_DIMS = 256;

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "mock:hashed-words-v1";

  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map((text) => {
      const v = new Float32Array(MOCK_DIMS);
      for (const word of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
        if (word.length < 3 || STOPWORDS.has(word)) continue;
        const stem = word.replace(/(ing|ings|es|s|ed)$/, "");
        v[fnv1a(stem) % MOCK_DIMS] += 1;
      }
      return normalize(v);
    });
  }
}

export const STOPWORDS = new Set(
  "the and for are but not you your with that this from have has had was were what when where which who why how can did does about into than then them they their there these those will would should could been being our out all any his her its one two".split(
    " "
  )
);

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/** Cosine similarity of two already-normalized vectors (= dot product). */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  cached = VOYAGE_API_KEY ? new VoyageEmbeddingProvider(VOYAGE_API_KEY, VOYAGE_MODEL) : new MockEmbeddingProvider();
  return cached;
}
