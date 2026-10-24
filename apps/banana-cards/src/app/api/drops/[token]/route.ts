import { NextRequest, NextResponse } from "next/server";
import { dropsRepo } from "@/lib/db";

// What a drop link shows before anyone claims: what kind of drop, who's
// behind it, and whether it's open right now. No sign-in needed - the
// person opening it is often brand new. The card itself stays hidden until
// the reveal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const drop = dropsRepo.getByToken(token);
  if (!drop) {
    return NextResponse.json({ error: "That drop link doesn't match a card." }, { status: 404 });
  }
  return NextResponse.json({ drop: dropsRepo.toView(drop, new Date().toISOString()) });
}
