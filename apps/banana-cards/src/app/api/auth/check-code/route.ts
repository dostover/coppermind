import { NextRequest, NextResponse } from "next/server";
import { authRepo } from "@/lib/db";

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

  const result = authRepo.checkCode({ email, code, now: new Date().toISOString() });
  if (!result.valid) {
    return NextResponse.json({ error: "That code is invalid or has expired." }, { status: 401 });
  }

  // isNewFan tells the client which screen to show next: straight through to
  // /api/auth/sign-in for a returning fan, or a username-selection step that
  // then calls /api/auth/register for a new one. The code is NOT consumed by
  // this check - only whichever finalize call the client makes next spends it.
  return NextResponse.json({ valid: true, isNewFan: result.isNewFan });
}
