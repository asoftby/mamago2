/**
 * GET /api/public/event-categories
 * 
 * Возвращает категории и жанры для Event (publicationType = EVENT).
 * Структура: корневые категории с вложенными жанрами.
 */

import { NextRequest, NextResponse } from "next/server";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getActiveEventTaxonomy, getAvailableEventTaxonomy } from "@/server/discovery/eventTaxonomyAvailability";

export async function GET(request: NextRequest) {
  try {
    const requestedCity = request.nextUrl.searchParams.get("city");
    if (!requestedCity) {
      return NextResponse.json(
        { categories: await getActiveEventTaxonomy() },
        { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
      );
    }
    const citySlug = requestedCity.trim().toLowerCase();
    const city = await findCityBySlug(citySlug, { select: { id: true, slug: true } });
    if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });
    const categories = await getAvailableEventTaxonomy(city.id, city.slug);

    return NextResponse.json(
      { categories },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    console.error("[event-categories] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event categories" },
      { status: 500 }
    );
  }
}
