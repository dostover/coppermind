import { NextResponse } from "next/server";
import { tagsRepo } from "@/lib/db";

// Full tag vocabulary, for the review screen's tag picker/autocomplete and
// as the reuse-candidate list generateTags is given (FR-7.6).
export async function GET() {
  return NextResponse.json({ tags: tagsRepo.listAll() });
}
