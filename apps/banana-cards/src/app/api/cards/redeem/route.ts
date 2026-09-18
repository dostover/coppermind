import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redemptionCodesRepo, cardTemplatesRepo } from "@/lib/db";
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

  let instance;
  try {
    instance = redemptionCodesRepo.redeem({
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

  const template = cardTemplatesRepo.getById(instance.template_id);

  return NextResponse.json({
    card: {
      instanceId: instance.id,
      title: template?.title ?? "Unknown card",
      description: template?.description ?? "",
      type: template?.type ?? null,
    },
  });
}
