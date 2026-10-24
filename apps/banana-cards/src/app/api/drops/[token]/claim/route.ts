import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { DropError, dropSourceLabel, dropsRepo, setsRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";
import { cardForReveal, setStepsForNewCard } from "@/lib/reveal";

// Claims a stream or social drop's card for the signed-in fan. Same response
// shape as POST /api/cards/redeem (card, setProgress), plus sourceLabel - the
// "Watched live on the Banana Ball stream" / "From Static's drop" line the card carries for good.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { token } = await params;
  const existing = dropsRepo.getByToken(token);
  const alreadyOwned = existing ? setsRepo.ownsTemplate(fan.id, existing.template_id) : false;

  let result;
  try {
    result = dropsRepo.claim({ token, fanId: fan.id, newInstanceId: randomUUID(), now: new Date().toISOString() });
  } catch (err) {
    if (err instanceof DropError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const { instance, drop } = result;
  return NextResponse.json({
    card: cardForReveal(instance.id, instance.template_id),
    passOnCard: null,
    sourceLabel: dropSourceLabel(drop.kind, drop.source_name),
    setProgress: setStepsForNewCard(fan.id, instance.template_id, alreadyOwned),
  });
}
