import { headers } from "next/headers";

// Builds the absolute origin (e.g. "http://192.168.1.20:3000") from the
// request the page or route is answering, so a QR code encodes the same
// address the fan's browser is already using. That's what lets a second phone
// on the same network open it straight from the camera app - a hardcoded
// "localhost" would only ever work on the computer running the server.
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

// Where a fan's trade QR points. Scanning it opens the trade screen with
// that fan already looked up - or, for someone without an account yet, the
// quick-join step first (see src/app/trade/page.tsx).
export function tradeLinkFor(origin: string, fanId: string): string {
  return `${origin}/trade?with=${encodeURIComponent(fanId)}`;
}

export function giftLinkFor(origin: string, token: string): string {
  return `${origin}/gift/${encodeURIComponent(token)}`;
}

// Where a physical token's QR points: opening it shows the card face down,
// ready to reveal (see src/app/redeem/page.tsx).
export function redeemLinkFor(origin: string, code: string): string {
  return `${origin}/redeem?code=${encodeURIComponent(code)}`;
}
