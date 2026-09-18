import { NextRequest, NextResponse } from "next/server";
import { tradesRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// Either side of a pending trade can back out - the proposer (changed their
// mind before the other fan confirmed) or the recipient (declining instead
// of confirming). Once a trade is confirmed the cards have already moved;
// there's no unwind here on purpose (see card-value-model.md - trades are a
// single atomic in-person event, not a reversible transaction).
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
  if (trade.fan_a_id !== fan.id && trade.fan_b_id !== fan.id) {
    return NextResponse.json({ error: "This isn't your trade." }, { status: 403 });
  }
  if (trade.status !== "pending") {
    return NextResponse.json({ error: `This trade is already ${trade.status}.` }, { status: 400 });
  }

  tradesRepo.cancel(id);
  return NextResponse.json({ trade: { id, status: "cancelled" } });
}
