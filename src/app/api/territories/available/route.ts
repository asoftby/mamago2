import { NextResponse } from "next/server";
import { REFERENCE_DATA_CACHE_CONTROL } from "@/lib/http/referenceDataCacheHeaders";
import { isTerritorySection } from "@/lib/territory/territorySections";
import { listAvailableTerritories } from "@/server/territory/listAvailableTerritories";

const CACHE_HEADERS = { "Cache-Control": REFERENCE_DATA_CACHE_CONTROL };

/** Territories the global «Где?» selector can offer; `?section=journal|kuda|classes|birthday` marks unsupported ones. */
export async function GET(request: Request) {
  const sectionParam = new URL(request.url).searchParams.get("section");
  if (sectionParam && !isTerritorySection(sectionParam)) {
    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  }
  try {
    const result = await listAvailableTerritories(sectionParam as Parameters<typeof listAvailableTerritories>[0]);
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[territories/available GET]", error);
    return NextResponse.json({ error: "Failed to load territories" }, { status: 500 });
  }
}
