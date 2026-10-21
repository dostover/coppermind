import { NextRequest, NextResponse } from "next/server";
import { cardInstancesRepo, fansRepo, newId, sessionsRepo } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  getFanFromRequest,
  newSessionToken,
  sessionExpiryFrom,
} from "@/lib/authSession";

const MAX_DISPLAY_NAME_LENGTH = 30;

// Quick join: someone new scans another fan's trade or pass-it-on QR code
// and gets in with just a display name - no app install, no email round
// trip. This is the "no-install first trade" growth loop from
// claude/card-value-model.md. Returns the same bearer token + cookie pair as
// the email sign-in routes, so everything after joining (trading, claiming,
// the collection) works identically for a guest.
//
// tradeWithFanId: set when joining from a trade link. The new fan then gets
// a "Welcome to Banana Ball" starter card so they have something to offer in
// that first trade. Not set when joining from a pass-it-on link - the card
// being passed on is their first card instead.
//
// Demo-phase shortcut: guests have no email, so they can't sign back in on
// another device yet (see claude/technical-decisions.md, "Before real fans").
export async function POST(req: NextRequest) {
  if (getFanFromRequest(req)) {
    return NextResponse.json({ error: "You're already signed in." }, { status: 400 });
  }

  let body: { displayName?: string; tradeWithFanId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName) {
    return NextResponse.json({ error: "Pick a name other fans will see." }, { status: 400 });
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Names must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  const tradeWithFanId = typeof body.tradeWithFanId === "string" ? body.tradeWithFanId : "";
  if (tradeWithFanId && !fansRepo.getById(tradeWithFanId)) {
    return NextResponse.json(
      { error: "That trade link doesn't match a fan. Ask them to show their code again." },
      { status: 400 }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const fan = fansRepo.createGuest({ id: newId(), displayName, createdAt: nowIso });
  const welcomeCard = tradeWithFanId ? cardInstancesRepo.grantWelcome(fan.id, nowIso) : null;

  const token = newSessionToken();
  sessionsRepo.create({ token, fanId: fan.id, createdAt: nowIso, expiresAt: sessionExpiryFrom(now) });

  const res = NextResponse.json({
    fan: { id: fan.id, displayName: fan.display_name, guest: true },
    token,
    welcomeCardInstanceId: welcomeCard?.id ?? null,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
