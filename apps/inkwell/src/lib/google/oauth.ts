import { googleAuthRepo } from "@/lib/db";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from "@/lib/config";

// Google OAuth 2.0 (authorization-code flow) for the Google Docs export
// feature. Single implicit user (see google_auth's schema comment in db.ts),
// so there is exactly one connection for the whole app - no per-user state,
// no session cookies involved in the OAuth dance itself.
//
// Scope: `documents` alone is enough to create/read/update Google Docs
// (which is all this feature does) without also requesting broad Drive
// access - deliberately narrower than `drive` or even `drive.file`, both to
// minimize what a leaked token could do and because Google's OAuth consent
// screen treats fewer/narrower scopes as a smaller ask for the user
// approving it.
const SCOPES = ["https://www.googleapis.com/auth/documents"];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// A token is refreshed a bit before it actually expires, so a request never
// races a token that's valid when checked but expired by the time it
// reaches Google.
const REFRESH_SAFETY_MARGIN_MS = 2 * 60 * 1000;

export function buildGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // required to get a refresh_token back at all
    // Google only sends a refresh_token on a user's *first* consent for a
    // given client+scope combination; forcing the consent screen every time
    // guarantees we get one even on a reconnect after a prior disconnect.
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
}

async function postToTokenEndpoint(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token request failed (${res.status}): ${detail || res.statusText}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

// Called once, from the OAuth callback route, with the ?code= Google
// redirected back with. Persists the resulting tokens as the app's one
// google_auth row.
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const tokens = await postToTokenEndpoint(
    new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    })
  );
  if (!tokens.refresh_token) {
    // Shouldn't happen given access_type=offline + prompt=consent above, but
    // fail loudly rather than silently storing a connection that can never
    // refresh itself once the short-lived access_token expires.
    throw new Error(
      "Google did not return a refresh token. Try disconnecting any prior Inkwell access at " +
        "https://myaccount.google.com/permissions and connecting again."
    );
  }
  const now = new Date();
  googleAuthRepo.upsert({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope,
    now: now.toISOString(),
  });
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  return postToTokenEndpoint(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    })
  );
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google account not connected.");
    this.name = "GoogleNotConnectedError";
  }
}

// The one function callers (docsExport.ts) actually use: always returns an
// access token that's valid right now, transparently refreshing and
// persisting a new one first if the cached token is at/near expiry. Throws
// GoogleNotConnectedError if there's no connection yet at all, so callers
// can turn that into a clear "connect your Google account first" response
// rather than a confusing upstream 401.
export async function getValidAccessToken(): Promise<string> {
  const auth = googleAuthRepo.get();
  if (!auth) throw new GoogleNotConnectedError();

  const expiresAt = new Date(auth.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_SAFETY_MARGIN_MS) {
    return auth.accessToken;
  }

  const refreshed = await refreshAccessToken(auth.refreshToken);
  const now = new Date();
  googleAuthRepo.updateAccessToken({
    accessToken: refreshed.access_token,
    expiresAt: new Date(now.getTime() + refreshed.expires_in * 1000).toISOString(),
    now: now.toISOString(),
  });
  return refreshed.access_token;
}

export function isGoogleConnected(): boolean {
  return Boolean(googleAuthRepo.get());
}
