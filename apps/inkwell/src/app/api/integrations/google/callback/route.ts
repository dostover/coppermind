import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google/oauth";

// Google redirects here after the user approves (or denies) access on the
// consent screen. Lands back on /library either way - that's where the
// connection status control lives - with ?googleError=... on failure so the
// page can surface what went wrong instead of failing silently.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error"); // e.g. "access_denied" if the user declined

  if (oauthError) {
    return NextResponse.redirect(`${origin}/library?googleError=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/library?googleError=${encodeURIComponent("No authorization code returned.")}`);
  }

  try {
    await exchangeCodeForTokens(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed.";
    return NextResponse.redirect(`${origin}/library?googleError=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}/library?googleConnected=1`);
}
