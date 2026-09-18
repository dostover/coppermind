import { NextRequest, NextResponse } from "next/server";
import { cardInstancesRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// JSON twin of the /collection page - same underlying query, so a future
// mobile client can fetch a fan's collection without the server-rendered
// page being the only way to get at it (see claude/technical-decisions.md's
// API-first decision).
export async function GET(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const cards = cardInstancesRepo.listByOwnerWithTemplate(fan.id);
  return NextResponse.json({ cards });
}
