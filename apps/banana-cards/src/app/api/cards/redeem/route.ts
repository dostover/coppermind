import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redemptionCodesRepo, setsRepo } from "@/lib/db";
import { cardForReveal, setStepsForNewCard } from "@/lib/reveal";
import { getFanFromRequest } from "@/lib/authSession";

export async function POST(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Enter a code." }, { status: 400 });
  }

  // Whether the fan already had this card decides whether redeeming it moves
  // any set forward (a second copy doesn't). Read before redeeming.
  const codeRow = redemptionCodesRepo.getByCode(code);
  const alreadyOwned = codeRow ? setsRepo.ownsTemplate(fan.id, codeRow.template_id) : false;

  let result;
  try {
    result = redemptionCodesRepo.redeem({
      code,
      fanId: fan.id,
      newInstanceId: randomUUID(),
      redeemedAt: new Date().toISOString(),
    });
  } catch {
    // redemptionCodesRepo.redeem throws for an unknown code or one that's
    // already redeemed/void - both are the fan's situation (a typo, or the
    // token was already scanned), not a server error, so this is a 400 with
    // a message written for a fan standing in a ballpark.
    const status = codeRow?.status;
    const message =
      status === "redeemed"
        ? "This card has already been claimed. Each token works once."
        : status === "void"
          ? "This token isn't active anymore."
          : "That code doesn't match a card. Check it and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { instance, passOnInstance } = result;

  return NextResponse.json({
    card: cardForReveal(instance.id, instance.template_id),
    // Set only on a fan's first redemption: the bonus card they're meant to
    // give to someone new (see giftsRepo in src/lib/db.ts).
    passOnCard: passOnInstance ? { instanceId: passOnInstance.id } : null,
    // Every set this card belongs to, with the fan's progress after
    // redeeming it (see src/lib/reveal.ts).
    setProgress: setStepsForNewCard(fan.id, instance.template_id, alreadyOwned),
  });
}
