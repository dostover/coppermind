import { NextRequest, NextResponse } from "next/server";
import { GiftError, giftsRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// Claims a pass-it-on card for the signed-in fan. Someone brand new reaches
// this right after POST /api/auth/join (the /gift/[token] page chains the
// two), so it's always an authenticated call - the guest just got their
// session a moment earlier.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { token } = await params;
  try {
    giftsRepo.claim({ token, toFanId: fan.id, now: new Date().toISOString() });
  } catch (err) {
    if (err instanceof GiftError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({ gift: giftsRepo.getView(token, new Date().toISOString()) });
}
