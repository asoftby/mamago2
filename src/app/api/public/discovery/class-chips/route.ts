import { isDeferredPublicFeatureEnabled } from "@/lib/config/publicReleaseScope";
import { NextResponse } from "next/server";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";

export const runtime = "nodejs";

export async function GET() {
  if (!isDeferredPublicFeatureEnabled("classes")) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const chips = await listDiscoveryClassChips();
  return NextResponse.json(chips);
}
