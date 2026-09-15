import { NextResponse } from "next/server";
import { googleAuthRepo } from "@/lib/db";

// Revokes nothing on Google's side (the user can do that at
// https://myaccount.google.com/permissions) - this just forgets the stored
// tokens locally, so Inkwell can no longer export until reconnected.
export async function POST() {
  googleAuthRepo.disconnect();
  return NextResponse.json({ ok: true });
}
