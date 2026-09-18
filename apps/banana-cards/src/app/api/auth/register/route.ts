import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authRepo } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_DAYS, newSessionToken, sessionExpiryFrom } from "@/lib/authSession";

const MAX_DISPLAY_NAME_LENGTH = 30;

// For a brand-new email (see check-code's isNewFan flag). An email that
// already has an account should hit /api/auth/sign-in instead.
export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string; displayName?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string; displayName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Choose a display name." }, { status: 400 });
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  const now = new Date();
  let result;
  try {
    result = authRepo.completeRegistration({
      email,
      code,
      now: now.toISOString(),
      sessionExpiresAt: sessionExpiryFrom(now),
      newFanId: randomUUID(),
      displayName,
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
