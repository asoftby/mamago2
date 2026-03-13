/**
 * Build Media Page Title
 * 
 * Creates a human-readable title for media detail page.
 * Format: "PlaceName, City, Street, House - N" (if multiple photos)
 */

import { MediaMetadataContext } from "./generateMediaMetadata";

interface MediaPageTitleOptions {
  context: MediaMetadataContext | null;
  mediaId: string;
  allMediaForEntity?: Array<{ id: string; createdAt: Date }>;
}

/**
 * Build page title for media detail page
 * 
 * Examples:
 * - "Пуговка, Минск, Ратомская, 7"
 * - "Пуговка, Минск, Ратомская, 7 - 2" (if multiple photos)
 * - "Пуговка" (if no address)
 * - "1773059228904-wvafz4jcqyn.webp" (fallback)
 */
export function buildMediaPageTitle(
  options: MediaPageTitleOptions,
  fallback: string
): string {
  const { context, mediaId, allMediaForEntity } = options;

  // No context - use fallback
  if (!context || !context.entityTitle) {
    return fallback;
  }

  // For PLACE: build title with address
  if (context.entityType === "PLACE" && context.placeAddress) {
    const parts: string[] = [];

    // Add place title
    parts.push(context.entityTitle);

    // Add address if available
    if (context.placeAddress.shortAddress) {
      parts.push(context.placeAddress.shortAddress);
    } else if (context.placeAddress.cityName) {
      parts.push(context.placeAddress.cityName);
    }

    let title = parts.join(", ");

    // Add photo number if multiple photos
    if (allMediaForEntity && allMediaForEntity.length > 1) {
      // Sort by createdAt to get consistent ordering
      const sorted = [...allMediaForEntity].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      const index = sorted.findIndex((m) => m.id === mediaId);
      if (index !== -1) {
        title += ` - ${index + 1}`;
      }
    }

    return title;
  }

  // For other entity types: just use entity title
  return context.entityTitle;
}
