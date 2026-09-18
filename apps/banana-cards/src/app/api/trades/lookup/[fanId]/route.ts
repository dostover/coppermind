import { NextRequest, NextResponse } from "next/server";
import { fansRepo, cardInstancesRepo, tradesRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";

// Resolves a fan code shown in person (see card-value-model.md's mutual
// QR-scan trade mechanism) into that fan's name and their trade-eligible
// cards. This is deliberately scoped to one already-known fan id, not a
// searchable directory - you can only look someone up once you already have
// their code, which in the real product means they physically showed it to
// you. That's what keeps this from reintroducing a browsable "who has what"
// marketplace listing.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fanId: string }> }
) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { fanId } = await params;
  if (fanId === fan.id) {
    return NextResponse.json({ error: "You can't trade with yourself." }, { status: 400 });
  }

  const other = fansRepo.getById(fanId);
  if (!other) {
    return NextResponse.json({ error: "No fan found with that code." }, { status: 404 });
  }

  const cards = cardInstancesRepo
    .listByOwnerWithTemplate(fanId)
    .filter((card) => !tradesRepo.isCardInPendingTrade(card.instance_id));

  return NextResponse.json({
    fan: { id: other.id, displayName: other.display_name },
    cards,
  });
}
