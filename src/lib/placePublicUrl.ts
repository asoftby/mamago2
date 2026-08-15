import { absolutePublicUrl, normalizePath } from "@/lib/seo/schema/url";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";

/**
 * Place Public URL Utilities
 * Builds public-facing URLs for places
 */

function normalizePlaceSegment(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? encodeURIComponent(trimmed) : null;
}

/**
 * `citySlug` is optional here (not on `getPlaceCityPublicPath` below)
 * purely so existing callers that don't have city data in scope keep
 * compiling and keep working — they get the legacy `/places/{slug}` path,
 * which still 301-redirects to the real city-scoped canonical (see
 * `src/app/(public)/places/[slug]/page.tsx`), never a dead link. New
 * callers that have `place.city.slug` available should pass it (or call
 * `getPlaceCityPublicPath` directly) to avoid the extra redirect hop —
 * tracked in BACKLOG-118.
 */
export function getPlacePublicPath(place: {
  slug?: string | null;
  id?: string | null;
  citySlug?: string | null;
}): string | null {
  const segment = normalizePlaceSegment(place.slug) ?? normalizePlaceSegment(place.id);
  if (!segment) {
    return null;
  }

  if (place.citySlug) {
    return normalizePath(buildCityPublicPath({ citySlug: place.citySlug, type: "place", slug: segment }));
  }

  return normalizePath(`/places/${segment}`);
}

export function getAbsolutePlacePublicUrl(place: {
  slug?: string | null;
  id?: string | null;
  citySlug?: string | null;
}): string | null {
  const path = getPlacePublicPath(place);
  return path ? absolutePublicUrl(path) ?? null : null;
}

/**
 * Get public URL for a place
 * Returns null if place is not published or has no slug
 *
 * @param place - Place object with status and slug
 * @returns Public URL or null
 */
export function getPlacePublicUrl(place: {
  status: string;
  slug: string | null;
  id?: string | null;
  citySlug?: string | null;
}): string | null {
  // Only published places have public URLs
  if (place.status !== "PUBLISHED") {
    return null;
  }

  return getAbsolutePlacePublicUrl(place);
}

/**
 * Check if place has a public URL
 * 
 * @param place - Place object with status and slug
 * @returns true if place has public URL
 */
export function hasPlacePublicUrl(place: {
  status: string;
  slug: string | null;
}): boolean {
  return place.status === "PUBLISHED" && !!place.slug;
}
