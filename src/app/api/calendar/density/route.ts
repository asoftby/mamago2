import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildKudaDiscoveryWhere } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import { countEventSessionsByDay } from "@/server/discovery/eventDensity";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const city = await findCityBySlug(p.get("city") ?? "minsk");
  if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });
  const window = resolveEventDateRange({ from: p.get("windowFrom"), to: p.get("windowTo") });
  if (!window) return NextResponse.json({ error: "INVALID_WINDOW" }, { status: 400 });
  const { where } = await buildKudaDiscoveryWhere(city.id, city.slug, {
    format: parseActivityFormatQuery(p.get("format")),
    eventFilters: { dateRange: null, free: p.get("free") === "true", districtId: p.get("district"), metroId: p.get("metro"), adultOnly: p.get("adultOnly") === "true" },
  });
  const sessions = await prisma.activitySession.findMany({ where: { startsAt: { gte: window.start, lt: window.end }, activity: { is: where } }, select: { startsAt: true } });
  return NextResponse.json(countEventSessionsByDay(sessions));
}
