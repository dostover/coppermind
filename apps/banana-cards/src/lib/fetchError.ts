// Mirrors apps/inkwell's fetchError.ts - every client component that does
// `if (!res.ok) throw new Error(...)` after a fetch uses this instead of
// `(await res.json()).error ?? fallback` directly, so a non-JSON error
// response (an empty-body 500, say) surfaces as the caller's own fallback
// message rather than a confusing JSON-parse SyntaxError.
export async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}
