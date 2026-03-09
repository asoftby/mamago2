/**
 * Place Public URL Utilities
 * Builds public-facing URLs for places
 */

import { ContentStatus } from "@prisma/client";

/**
 * Get public URL for a place
 * Returns null if place is not published or has no slug
 * 
 * @param place - Place object with status and slug
 * @returns Public URL or null
 */
export function getPlacePublicUrl(place: {
  status: ContentStatus;
  slug: string | null;
}): string | null {
  // Only published places have public URLs
  if (place.status !== "PUBLISHED") {
    return null;
  }

  // Must have slug
  if (!place.slug) {
    return null;
  }

  return `/places/${place.slug}`;
}

/**
 * Check if place has a public URL
 * 
 * @param place - Place object with status and slug
 * @returns true if place has public URL
 */
export function hasPlacePublicUrl(place: {
  status: ContentStatus;
  slug: string | null;
}): boolean {
  return place.status === "PUBLISHED" && !!place.slug;
}
