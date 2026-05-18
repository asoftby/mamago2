/**
 * GET /api/geo/metro-stations?cityId=xxx
 * GET /api/geo/metro-stations?citySlug=minsk
 * Get all metro stations for a city
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { REFERENCE_DATA_CACHE_CONTROL } from "@/lib/http/referenceDataCacheHeaders";
import { resolveCityIdBySlug } from "@/server/geo/resolveCityIdBySlug";

const CACHE_HEADERS = { "Cache-Control": REFERENCE_DATA_CACHE_CONTROL };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get("cityId");
    const citySlug = searchParams.get("citySlug");

    if (!cityId && !citySlug) {
      return NextResponse.json(
        { error: "cityId or citySlug is required" },
        { status: 400 }
      );
    }

    // Resolve cityId from slug if needed
    let resolvedCityId = cityId;
    if (!resolvedCityId && citySlug) {
      resolvedCityId = await resolveCityIdBySlug(citySlug);

      if (!resolvedCityId) {
        return NextResponse.json({ metroStations: [] }, { headers: CACHE_HEADERS });
      }
    }

    const stations = await prisma.metroStation.findMany({
      where: { cityId: resolvedCityId! },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ metroStations: stations }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Get metro stations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
