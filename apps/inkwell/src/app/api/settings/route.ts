import { NextRequest, NextResponse } from "next/server";
import { settingsRepo } from "@/lib/db";

// Settings screen preferences. Only the Google Docs background-check toggle
// for now; the job runner reads it on every tick, so a change applies
// without a restart.

export async function GET() {
  return NextResponse.json({ docsBackgroundCheck: settingsRepo.getDocsBackgroundCheck() });
}

export async function PATCH(req: NextRequest) {
  let body: { docsBackgroundCheck?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.docsBackgroundCheck !== "boolean") {
    return NextResponse.json({ error: "docsBackgroundCheck must be true or false." }, { status: 400 });
  }
  settingsRepo.setDocsBackgroundCheck(body.docsBackgroundCheck, new Date().toISOString());
  return NextResponse.json({ docsBackgroundCheck: settingsRepo.getDocsBackgroundCheck() });
}
