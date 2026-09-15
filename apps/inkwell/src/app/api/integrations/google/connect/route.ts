import { NextResponse } from "next/server";
import { GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";

// Starts the OAuth flow: redirects the browser straight to Google's consent
// screen. A GET (not POST) so it can be a plain <a href> in the UI - no
// state needed beyond what Google itself round-trips, since this app has no
// per-user sessions to tie the callback back to (single implicit user).
export async function GET() {
  if (!GOOGLE_OAUTH_CONFIGURED) {
    return NextResponse.json(
      { error: "Google integration isn't configured yet - set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (see README)." },
      { status: 501 }
    );
  }
  return NextResponse.redirect(buildGoogleAuthUrl());
}
