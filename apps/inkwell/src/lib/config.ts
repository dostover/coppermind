// App-level configuration constants (not hardcoded inline per FR-4.6).
// See claude/08-walking-skeleton-scope.md, assumption A2.

export const CONFIDENCE_THRESHOLD = process.env.CONFIDENCE_THRESHOLD
  ? Number(process.env.CONFIDENCE_THRESHOLD)
  : 0.7;
