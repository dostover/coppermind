import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";

// Cookie name/lifetime for the CSRF state token - see oauth.ts's
// buildGoogleAuthUrl comment. Short-lived: it only needs to survive the
// round trip to Google's consent screen and back.
export const OAUTH_STATE_COOKIE = "google_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

// Starts the OAuth flow: redirects the browser straight to Google's consent
// screen. A GET (not POST) so it can be a plain <a href> in the UI. This app
// has no per-user sessions to tie the callback back to (single implicit
// user), but the flow still needs a CSRF `state` token - see oauth.ts.
export async function GET() {
  if (!GOOGLE_OAUTH_CONFIGURED) {
    return NextResponse.json(
      { error: "Google integration isn't configured yet - set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (see README)." },
      { status: 501 }
    );
  }
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(buildGoogleAuthUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/api/integrations/google",
  });
  return res;
}
