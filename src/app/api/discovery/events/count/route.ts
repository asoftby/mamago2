import { NextRequest, NextResponse } from "next/server";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { countKudaDiscoveryEvents } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const city = await findCityBySlug(p.get("city") ?? "minsk");
  if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });
  const preset = p.get("preset");
  const count = await countKudaDiscoveryEvents(city.id, city.slug, {
    format: parseActivityFormatQuery(p.get("format")),
    eventFilters: {
      dateRange: resolveEventDateRange({ preset: preset === "TODAY" || preset === "TOMORROW" || preset === "WEEKEND" ? preset : null, from: p.get("from"), to: p.get("to") }),
      free: p.get("free") === "true",
      districtId: p.get("district"), metroId: p.get("metro"), adultOnly: p.get("adultOnly") === "true",
    },
  });
  return NextResponse.json({ count });
}
