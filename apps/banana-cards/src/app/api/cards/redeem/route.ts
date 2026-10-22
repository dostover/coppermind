import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redemptionCodesRepo, cardTemplatesRepo, parseCardStats, setsRepo } from "@/lib/db";
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
  } catch (err) {
    // redemptionCodesRepo.redeem throws for an unknown code or one that's
    // already redeemed/void - both are the fan's mistake (a typo, or someone
    // else already claimed this one), not a server error, so this is a 400
    // rather than a 500.
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const { instance, passOnInstance } = result;
  const template = cardTemplatesRepo.getById(instance.template_id);

  return NextResponse.json({
    card: {
      instanceId: instance.id,
      title: template?.title ?? "Unknown card",
      description: template?.description ?? "",
      type: template?.type ?? null,
      stats: parseCardStats(template?.stats ?? null),
    },
    // Set only on a fan's first redemption: the bonus card they're meant to
    // give to someone new (see giftsRepo in src/lib/db.ts).
    passOnCard: passOnInstance ? { instanceId: passOnInstance.id } : null,
    // Every set this card belongs to, with the fan's progress after
    // redeeming it. newlyCompleted is true only when this card was the last
    // one missing - the moment the set's perk unlocks.
    setProgress: setsRepo
      .listProgressForFan(fan.id)
      .filter((set) => set.items.some((item) => item.templateId === instance.template_id))
      .map((set) => ({
        title: set.title,
        owned: set.owned,
        total: set.total,
        complete: set.complete,
        newlyCompleted: set.complete && !alreadyOwned,
        perkTitle: set.perk.title,
      })),
  });
}
