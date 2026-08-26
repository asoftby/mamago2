import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildKudaDiscoveryWhere } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import { buildPriceDistribution } from "@/server/discovery/priceDistribution";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const city = await findCityBySlug(p.get("city") ?? "minsk");
  if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });
  const preset = p.get("preset");
  const { where } = await buildKudaDiscoveryWhere(city.id, city.slug, {
    format: parseActivityFormatQuery(p.get("format")),
    nearby: p.get("nearby") === "true",
    eventFilters: {
      categorySlugs: p.get("category")?.split(",").filter(Boolean) ?? [],
      genreSlugs: p.get("genre")?.split(",").filter(Boolean) ?? [],
      dateRange: resolveEventDateRange({ preset: preset === "TODAY" || preset === "TOMORROW" || preset === "WEEKEND" ? preset : null, from: p.get("from"), to: p.get("to") }),
      free: p.get("free") === "true",
      priceMax: null,
      districtId: p.get("district"),
      metroId: p.get("metro"),
      adultOnly: p.get("adultOnly") === "true",
    },
  });
  const rows = await prisma.activity.findMany({
    where: { AND: [where, { priceMode: { in: ["FREE", "EXACT", "FROM", "RANGE"] }, priceFrom: { not: null } }] },
    select: { priceFrom: true },
  });
  return NextResponse.json(buildPriceDistribution(rows.flatMap((row) => row.priceFrom == null ? [] : [row.priceFrom])));
}
