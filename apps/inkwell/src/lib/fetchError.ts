// Shared by every client component that does `if (!res.ok) throw new
// Error(...)` after a fetch. The naive version of that -
// `(await res.json()).error ?? fallback` - itself throws (an unrelated
// "Unexpected end of JSON input"/similar SyntaxError that masks whatever
// the server actually said) whenever the error response isn't valid JSON,
// which a bare framework 500 with an empty body always is - found via E2E
// testing that hit exactly that path (a route that could 500 with no body).
// Every caller uses this instead so a server bug always surfaces as that
// call's own fallback message rather than a confusing JS parse error.
export async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}
