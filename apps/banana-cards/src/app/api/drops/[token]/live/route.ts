import { NextRequest, NextResponse } from "next/server";
import { dropsRepo } from "@/lib/db";

// Starts or ends a stream drop: { live: true | false }. Demo-only stand-in
// for the stream producer's control (the /drops console). A real version
// would sit behind team/staff accounts, which this demo doesn't have yet, so
// it's switched off entirely in production builds.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { token } = await params;
  const drop = dropsRepo.getByToken(token);
  if (!drop || drop.kind !== "stream") {
    return NextResponse.json({ error: "No stream drop with that link." }, { status: 404 });
  }

  let body: { live?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.live !== "boolean") {
    return NextResponse.json({ error: "live must be true or false." }, { status: 400 });
  }

  dropsRepo.setLive(token, body.live);
  return NextResponse.json({ drop: dropsRepo.toView(dropsRepo.getByToken(token)!, new Date().toISOString()) });
}
