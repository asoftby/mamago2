import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { isHalloweenOccasionActive } from "@/server/discovery/activeHalloweenOccasion";
import { loadKudaListingPage, parseListingPage } from "@/server/discovery/kudaListingPage";

/**
 * Next afisha page for client-side infinite scroll. Same ranking, filters and
 * «Для кого» partition as the SSR `?page=N` render of `/{city}/events`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // `listingCity` (not `city`): listing URLs may carry their own `city` query param.
  const city = await findCityBySlug(params.get("listingCity") ?? "minsk");
  if (!city) return NextResponse.json({ error: "CITY_NOT_FOUND" }, { status: 404 });

  const [user, halloweenEnabled] = await Promise.all([getCurrentUser(), isHalloweenOccasionActive()]);
  const listing = await loadKudaListingPage({
    cityId: city.id,
    citySlug: city.slug,
    userId: user?.id ?? null,
    searchParams: params,
    page: parseListingPage(params.get("page")),
    halloweenEnabled,
  });

  return NextResponse.json(
    {
      page: listing.page,
      totalPages: listing.totalPages,
      total: listing.total,
      offset: listing.offset,
      items: listing.items,
      secondaryHeading: listing.secondaryHeading,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
