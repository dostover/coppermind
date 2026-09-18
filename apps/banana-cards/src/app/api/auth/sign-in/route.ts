import { NextRequest, NextResponse } from "next/server";
import { authRepo } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_DAYS, newSessionToken, sessionExpiryFrom } from "@/lib/authSession";

// For an email that already has an account. A new email should hit
// /api/auth/register instead (see check-code's isNewFan flag).
export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }

  const now = new Date();
  let result;
  try {
    result = authRepo.completeSignIn({
      email,
      code,
      now: now.toISOString(),
      sessionExpiresAt: sessionExpiryFrom(now),
      newSessionToken: newSessionToken(),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }

  const res = NextResponse.json({
    fan: { id: result.fan.id, displayName: result.fan.display_name },
    token: result.session.token,
  });
  res.cookies.set(SESSION_COOKIE, result.session.token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
