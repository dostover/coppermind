import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { GiftError, giftsRepo } from "@/lib/db";
import { getFanFromRequest } from "@/lib/authSession";
import { getRequestOrigin, giftLinkFor } from "@/lib/origin";

// Starts a pass-it-on handoff: the signed-in fan picks one of their
// pass-it-on cards and gets back a one-time link (and a QR of it) to show
// someone new in person. It expires after GIFT_TTL_MINUTES, so claiming it
// still means the two of them were together. The QR is generated here,
// server-side, the same way the /trade page's QR is, so no client needs a
// QR library.
export async function POST(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { cardInstanceId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const cardInstanceId = typeof body.cardInstanceId === "string" ? body.cardInstanceId : "";
  if (!cardInstanceId) {
    return NextResponse.json({ error: "cardInstanceId is required." }, { status: 400 });
  }

  let gift;
  try {
    gift = giftsRepo.create({ fromFanId: fan.id, cardInstanceId, now: new Date() });
  } catch (err) {
    if (err instanceof GiftError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const url = giftLinkFor(await getRequestOrigin(), gift.token);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });

  return NextResponse.json({
    gift: { token: gift.token, url, qrDataUrl, expiresAt: gift.expires_at },
  });
}
