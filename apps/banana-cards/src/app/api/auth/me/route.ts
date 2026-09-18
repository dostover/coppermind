import { NextRequest, NextResponse } from "next/server";
import { getFanFromRequest } from "@/lib/authSession";

export async function GET(req: NextRequest) {
  const fan = getFanFromRequest(req);
  if (!fan) {
    return NextResponse.json({ fan: null }, { status: 401 });
  }
  return NextResponse.json({ fan: { id: fan.id, displayName: fan.display_name } });
}
