import { NextRequest, NextResponse } from "next/server";
import { giftsRepo } from "@/lib/db";

// What the /gift/[token] page shows before anyone claims: who's passing the
// card on and which card it is. No sign-in needed - the person scanning is
// usually brand new and doesn't have an account yet. Only someone holding
// the token (i.e. who was just shown the QR) can see it.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const gift = giftsRepo.getView(token, new Date().toISOString());
  if (!gift) {
    return NextResponse.json({ error: "That pass-it-on code isn't valid." }, { status: 404 });
  }
  return NextResponse.json({ gift });
}
