import { randomInt, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { fansRepo, sessionsRepo, type FanRow } from "./db";

// See claude/technical-decisions.md: bearer token is the real mechanism (so a
// future mobile client needs nothing new), the cookie is a convenience layer
// on top purely for the web reference client so page loads can read the
// session server-side without any client-side fetch wrapper.
export const SESSION_COOKIE = "banana_cards_session";

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const SESSION_TTL_DAYS = 90;

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export function newSessionToken(): string {
  // A session token just needs to be unguessable, not a UUID specifically -
  // randomUUID is used for convenience/consistency with the rest of the
  // codebase's id generation, not because UUID structure matters here.
  return randomUUID();
}

export function sessionExpiryFrom(now: Date): string {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires.toISOString();
}

export function codeExpiryFrom(now: Date): string {
  const expires = new Date(now);
  expires.setMinutes(expires.getMinutes() + CODE_TTL_MINUTES);
  return expires.toISOString();
}

// Bearer header takes priority (the canonical mechanism); the cookie is the
// fallback so the web reference client's own page loads work without every
// page having to attach the header itself.
function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();

  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  return cookieToken ?? null;
}

export function getFanFromRequest(req: NextRequest): FanRow | null {
  const token = extractToken(req);
  if (!token) return null;

  const session = sessionsRepo.getValidByToken(token, new Date().toISOString());
  if (!session) return null;

  const fan = fansRepo.getById(session.fan_id);
  return fan ?? null;
}

// Server-component equivalent of getFanFromRequest - reads the session
// cookie directly via next/headers rather than off a NextRequest, since a
// server component (page.tsx) doesn't have one. Used by every page that
// needs to know who's signed in without a round trip to /api/auth/me.
export async function getFanFromCookies(): Promise<FanRow | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = sessionsRepo.getValidByToken(token, new Date().toISOString());
  if (!session) return null;

  const fan = fansRepo.getById(session.fan_id);
  return fan ?? null;
}
