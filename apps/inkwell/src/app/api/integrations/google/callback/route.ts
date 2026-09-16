import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { OAUTH_STATE_COOKIE } from "@/app/api/integrations/google/connect/route";

// Google redirects here after the user approves (or denies) access on the
// consent screen. Lands back on /library either way - that's where the
// connection status control lives - with ?googleError=... on failure so the
// page can surface what went wrong instead of failing silently.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error"); // e.g. "access_denied" if the user declined
  const returnedState = searchParams.get("state");
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // Clear the one-time state cookie on every outcome - it's single-use
  // regardless of whether this attempt succeeds, fails, or is a forgery.
  function withClearedStateCookie(res: NextResponse): NextResponse {
    res.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/integrations/google" });
    return res;
  }

  if (!GOOGLE_OAUTH_CONFIGURED) {
    return withClearedStateCookie(
      NextResponse.redirect(
        `${origin}/library?googleError=${encodeURIComponent("Google integration isn't configured.")}`
      )
    );
  }

  // Reject if the state Google echoed back doesn't match the one we minted
  // in connect/route.ts (or there's no cookie at all, e.g. it expired or
  // this request didn't originate from our own /connect redirect) - see
  // oauth.ts's buildGoogleAuthUrl comment for the threat this defends
  // against.
  if (!expectedState || !returnedState || returnedState !== expectedState) {
    return withClearedStateCookie(
      NextResponse.redirect(
        `${origin}/library?googleError=${encodeURIComponent("Google sign-in request could not be verified. Please try connecting again.")}`
      )
    );
  }

  if (oauthError) {
    return withClearedStateCookie(
      NextResponse.redirect(`${origin}/library?googleError=${encodeURIComponent(oauthError)}`)
    );
  }
  if (!code) {
    return withClearedStateCookie(
      NextResponse.redirect(
        `${origin}/library?googleError=${encodeURIComponent("No authorization code returned.")}`
      )
    );
  }

  try {
    await exchangeCodeForTokens(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed.";
    return withClearedStateCookie(
      NextResponse.redirect(`${origin}/library?googleError=${encodeURIComponent(message)}`)
    );
  }

  return withClearedStateCookie(NextResponse.redirect(`${origin}/library?googleConnected=1`));
}
