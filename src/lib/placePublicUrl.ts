import { absolutePublicUrl, normalizePath } from "@/lib/seo/schema/url";

/**
 * Place Public URL Utilities
 * Builds public-facing URLs for places
 */

function normalizePlaceSegment(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? encodeURIComponent(trimmed) : null;
}

export function getPlacePublicPath(place: {
  slug?: string | null;
  id?: string | null;
}): string | null {
  const segment = normalizePlaceSegment(place.slug) ?? normalizePlaceSegment(place.id);
  if (!segment) {
    return null;
  }

  return normalizePath(`/places/${segment}`);
}

export function getAbsolutePlacePublicUrl(place: {
  slug?: string | null;
  id?: string | null;
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
