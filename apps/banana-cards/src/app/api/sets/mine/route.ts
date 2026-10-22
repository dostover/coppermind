import { NextRequest, NextResponse } from "next/server";
import { setsRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// The signed-in fan's progress through every set, with each set's perk and
// whether it's unlocked. API-first twin of the Sets section on /collection
// (see claude/technical-decisions.md).
export async function GET(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return NextResponse.json({ sets: setsRepo.listProgressForFan(fan.id) });
}
