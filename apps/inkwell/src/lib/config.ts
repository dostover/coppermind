// App-level configuration constants (not hardcoded inline per FR-4.6).
// See claude/08-walking-skeleton-scope.md, assumption A2.

export const CONFIDENCE_THRESHOLD = process.env.CONFIDENCE_THRESHOLD
  ? Number(process.env.CONFIDENCE_THRESHOLD)
  : 0.7;

// Google Docs export (src/lib/google/): all three are unset by default, same
// spirit as ANTHROPIC_API_KEY - the feature is simply unavailable (not an
// error) until configured. See README for how to obtain a client id/secret.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
// Must exactly match an "Authorized redirect URI" on the OAuth client in
// Google Cloud Console.
export const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/integrations/google/callback";
export const GOOGLE_OAUTH_CONFIGURED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
