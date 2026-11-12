import { NextRequest, NextResponse } from "next/server";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { countKudaDiscoveryEvents } from "@/server/discovery/kudaDiscoveryFeed";
import { buildKudaEventFilters } from "@/server/discovery/kudaListingPage";
import { getActivePublicOccasions } from "@/lib/discovery/occasions";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const city = await findCityBySlug(p.get("city") ?? "minsk");
  if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });

  const activeOccasions = await getActivePublicOccasions();
  const eventFilters = buildKudaEventFilters(p, new Set(activeOccasions.map(item => item.slug)));
  const count = await countKudaDiscoveryEvents(city.id, city.slug, {
    format: parseActivityFormatQuery(p.get("format")),
    explicitTerritorySlug: p.get("explore") === "1" ? city.slug : null,
    eventFilters,
  });
  return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
}
