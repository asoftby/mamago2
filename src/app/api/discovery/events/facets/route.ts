import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import { matchesManualAgeRanges } from "@/lib/discovery/audienceEligibility";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildKudaDiscoveryWhere } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";

/**
 * Availability facets for Kuda: every visible option corresponds to at least
 * one actual published event. The facet's own selection is omitted when
 * computing alternatives, so switching categories/format remains possible.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const city = await findCityBySlug(p.get("city") ?? "minsk");
  if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });

  const explicitTerritorySlug = p.get("explore") === "1" ? city.slug : null;
  const preset = p.get("preset");
  const { where } = await buildKudaDiscoveryWhere(city.id, city.slug, {
    explicitTerritorySlug,
    eventFilters: {
      categorySlugs: [], genreSlugs: [], occasionSlug: null,
      dateRange: resolveEventDateRange({
        preset: preset === "TODAY" || preset === "TOMORROW" || preset === "WEEKEND" ? preset : null,
        from: p.get("from"), to: p.get("to"),
      }),
      free: false, priceMin: null, priceMax: null,
      districtId: p.get("district"), metroId: p.get("metro"),
      adultOnly: p.get("adultOnly") === "true",
    },
  });
  const rows = await prisma.activity.findMany({
    where,
    select: {
      eventCategory: { select: { slug: true } },
      genreSlugs: true,
      format: true,
      priceMode: true, priceFrom: true,
      ageTags: true, ageMinMonths: true, ageMaxMonths: true, agePolicy: true,
      occasionLinks: {
        where: { occasion: { isActive: true } },
        select: { occasion: { select: { slug: true } } },
      },
    },
  });
  const categoryFilters = p.get("category")?.split(",").filter(Boolean) ?? [];
  const genreFilters = p.get("genre")?.split(",").filter(Boolean) ?? [];
  const ageFilters = p.get("age")?.split(",").filter(Boolean) ?? [];
  const format = parseActivityFormatQuery(p.get("format"));
  const priceMin = Number(p.get("priceMin"));
  const priceMax = Number(p.get("priceMax"));
  const hasPriceMin = p.has("priceMin") && Number.isFinite(priceMin) && priceMin > 0;
  const hasPriceMax = p.has("priceMax") && Number.isFinite(priceMax) && priceMax >= 0;
  const free = p.get("free") === "true";
  const occasion = p.get("occasion");

  const allowedForAge = (row: typeof rows[number], values: string[]) => {
    if (!values.length) return true;
    const bounds = row.agePolicy === "ADULT_ONLY"
      ? { ageFrom: 18, ageTo: 99 }
      : ageBoundsFromActivityFields(row);
    const ranges = values.flatMap(value => {
      const group = AGE_GROUPS.find(g => g.value === value);
      return group ? [{ id: group.value, min: group.min, max: group.max ?? 99 }] : [];
    });
    return matchesManualAgeRanges({
      agePolicy: row.agePolicy,
      ageFrom: bounds.ageFrom,
      ageTo: bounds.ageTo,
    }, ranges);
  };
  type Facet = "category" | "genre" | "format" | "age" | "price" | "occasion";
  const matches = (row: typeof rows[number], except: Facet) => {
    if (except !== "category" && categoryFilters.length && !categoryFilters.includes(row.eventCategory?.slug ?? "")) return false;
    if (except !== "genre" && genreFilters.length && !genreFilters.some(slug => row.genreSlugs.includes(slug))) return false;
    if (except !== "format" && format && row.format !== format) return false;
    if (except !== "age" && !allowedForAge(row, ageFilters)) return false;
    if (except !== "occasion" && occasion === "halloween" && !row.occasionLinks.some(link => link.occasion.slug === "halloween")) return false;
    if (except !== "price") {
      if (free && row.priceMode !== "FREE") return false;
      if (!free && (hasPriceMin || hasPriceMax) && (
        row.priceFrom == null ||
        !["FREE", "EXACT", "FROM", "RANGE"].includes(row.priceMode) ||
        (hasPriceMin && row.priceFrom < priceMin) ||
        (hasPriceMax && row.priceFrom > priceMax)
      )) return false;
    }
    return true;
  };
  const facetRows = (except: Facet) => rows.filter(row => matches(row, except));
  const categories = [...new Set(facetRows("category").map(row => row.eventCategory?.slug).filter((slug): slug is string => !!slug))];
  const genres = [...new Set(facetRows("genre").flatMap(row => row.genreSlugs))];
  const formats = [...new Set(facetRows("format").map(row => row.format))];
  const ages = AGE_GROUPS.filter(group => facetRows("age").some(row => allowedForAge(row, [group.value]))).map(group => group.value);
  const occasions = [...new Set(facetRows("occasion").flatMap(row => row.occasionLinks.map(link => link.occasion.slug)))];

  return NextResponse.json({
    categories, genres, formats, ages, occasions,
    freeAvailable: facetRows("price").some(row => row.priceMode === "FREE"),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
