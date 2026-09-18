import { NextRequest, NextResponse } from "next/server";
import { tradesRepo, nowIso } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// Only the recipient (fan_b - whoever didn't propose the trade) can confirm
// it. The proposer already committed to these terms by building them after
// seeing the recipient's collection in person; this is the second of the two
// confirmations the trade mechanism requires, and the one that actually
// executes the ownership swap (tradesRepo.confirm, one atomic transaction).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const trade = tradesRepo.getById(id);
  if (!trade) {
    return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  }
  if (trade.fan_b_id !== fan.id) {
    return NextResponse.json(
      { error: "Only the fan who received this proposal can confirm it." },
      { status: 403 }
    );
  }
  if (trade.status !== "pending") {
    return NextResponse.json({ error: `This trade is already ${trade.status}.` }, { status: 400 });
  }

  try {
    tradesRepo.confirm(id, nowIso());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  return NextResponse.json({ trade: { id, status: "confirmed" } });
}
