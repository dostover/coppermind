import { NextRequest, NextResponse } from "next/server";
import { fansRepo, cardInstancesRepo, tradesRepo, newId, nowIso } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// Proposes a trade: the signed-in fan offers one of their own cards and
// requests one of the other fan's cards (already surfaced to them via
// GET /api/trades/lookup/[fanId], which only works once they have that fan's
// code). Nothing moves yet - this just records both sides' intent as a
// pending trade. The proposer's act of building these terms after seeing the
// other fan's collection in person is the first of the two confirmations the
// trade mechanism requires; the recipient's explicit POST .../confirm is the
// second (see /api/trades/[id]/confirm).
export async function POST(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { toFanId?: string; offerCardInstanceId?: string; requestCardInstanceId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const toFanId = typeof body.toFanId === "string" ? body.toFanId : "";
  const offerCardInstanceId =
    typeof body.offerCardInstanceId === "string" ? body.offerCardInstanceId : "";
  const requestCardInstanceId =
    typeof body.requestCardInstanceId === "string" ? body.requestCardInstanceId : "";

  if (!toFanId || !offerCardInstanceId || !requestCardInstanceId) {
    return NextResponse.json(
      { error: "toFanId, offerCardInstanceId, and requestCardInstanceId are required." },
      { status: 400 }
    );
  }
  if (toFanId === fan.id) {
    return NextResponse.json({ error: "You can't trade with yourself." }, { status: 400 });
  }

  const other = fansRepo.getById(toFanId);
  if (!other) {
    return NextResponse.json({ error: "Unknown fan." }, { status: 400 });
  }

  const offerCard = cardInstancesRepo.getById(offerCardInstanceId);
  if (!offerCard || offerCard.owner_fan_id !== fan.id) {
    return NextResponse.json({ error: "That's not a card you own." }, { status: 400 });
  }
  const requestCard = cardInstancesRepo.getById(requestCardInstanceId);
  if (!requestCard || requestCard.owner_fan_id !== toFanId) {
    return NextResponse.json(
      { error: "That card isn't owned by the fan you're trading with." },
      { status: 400 }
    );
  }

  if (
    tradesRepo.isCardInPendingTrade(offerCardInstanceId) ||
    tradesRepo.isCardInPendingTrade(requestCardInstanceId)
  ) {
    return NextResponse.json(
      { error: "One of those cards is already part of another pending trade." },
      { status: 400 }
    );
  }

  const tradeId = newId();
  const createdAt = nowIso();
  tradesRepo.create({
    id: tradeId,
    fanAId: fan.id,
    fanBId: toFanId,
    createdAt,
    items: [
      { id: newId(), cardInstanceId: offerCardInstanceId, fromFanId: fan.id, toFanId },
      { id: newId(), cardInstanceId: requestCardInstanceId, fromFanId: toFanId, toFanId: fan.id },
    ],
  });

  return NextResponse.json({ trade: { id: tradeId, status: "pending" } });
}

// API-first twin of the /trade page's pending/confirmed lists, for a future
// mobile client (see claude/technical-decisions.md's API-first decision).
export async function GET(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  return NextResponse.json({ trades: tradesRepo.listForFan(fan.id) });
}
