import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { loginCodesRepo } from "@/lib/db";
import { generateCode, codeExpiryFrom } from "@/lib/authSession";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const now = new Date();
  const code = generateCode();

  loginCodesRepo.issue({
    id: randomUUID(),
    email,
    code,
    expiresAt: codeExpiryFrom(now),
    createdAt: now.toISOString(),
  });

  // No email-sending service is wired up yet (tracked as open in
  // claude/technical-decisions.md). Until then, the code is logged
  // server-side and echoed back in the response under devCode, clearly
  // marked, so the sign-in flow is fully exercisable end to end. Remove
  // devCode the moment real email delivery exists - shipping this to real
  // fans as-is would mean anyone could sign in as anyone by just requesting
  // their code back.
  console.log(`[dev] login code for ${email}: ${code}`);

  return NextResponse.json({ ok: true, devCode: code });
}
