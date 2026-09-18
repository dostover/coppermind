import { NextRequest, NextResponse } from "next/server";
import { sessionsRepo } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/authSession";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    sessionsRepo.revoke(token, new Date().toISOString());
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
