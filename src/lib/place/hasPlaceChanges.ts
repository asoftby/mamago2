/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Check if place has changes compared to original/published version
 * Uses same comparison logic as PlaceRevisionModerationView
 */

import { Place } from "@prisma/client";
import type { OpeningHoursData } from "@/components/openingHours";

type PlaceImage = {
  id: string;
  createdAt: Date;
  url: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  kind: any;
  sortOrder: number;
  placeId?: string;
  revisionId?: string;
};

type PlaceWithImages = Omit<Place, 'images'> & { images: PlaceImage[] };

/**
 * Normalize opening hours data for comparison
 * Sorts intervals and rules to avoid false positives from array ordering
 */
function normalizeOpeningHours(data: OpeningHoursData | null): OpeningHoursData | null {
  if (!data) return null;

  return {
    ...data,
    rules: data.rules
      .slice() // Create copy
      .sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek)) // Sort by day
      .map(rule => ({
        ...rule,
        intervals: rule.intervals
          .slice() // Create copy
          .sort((a, b) => a.startTime.localeCompare(b.startTime)) // Sort by start time
      }))
  };
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Compare two values and determine if they're different
 */
function hasChanged(oldValue: any, newValue: any): boolean {
  const oldEmpty = isEmpty(oldValue);
  const newEmpty = isEmpty(newValue);

  // Both empty = no change
  if (oldEmpty && newEmpty) return false;

  // One empty, one not = change
  if (oldEmpty !== newEmpty) return true;

  // Both have values - check if they're different
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    // Compare arrays
    if (oldValue.length !== newValue.length) return true;
    const sorted1 = [...oldValue].sort();
    const sorted2 = [...newValue].sort();
    return JSON.stringify(sorted1) !== JSON.stringify(sorted2);
  }

  // Compare primitives
  return oldValue !== newValue;
}

/**
 * Check if place has any changes compared to original
 * @param currentPlace - Current place state (with user edits)
 * @param originalPlace - Original place state (from database)
 * @param currentOpeningHours - Current opening hours state (UI state)
 * @param originalOpeningHours - Original opening hours state (UI state)
 * @returns true if there are changes, false otherwise
 */
export function hasPlaceChanges(
  currentPlace: PlaceWithImages,
  originalPlace: PlaceWithImages,
  currentOpeningHours?: OpeningHoursData | null,
  originalOpeningHours?: OpeningHoursData | null
): boolean {
  // Fields to compare
  const fieldsToCompare: Array<keyof Place> = [
    "title",
    "shortDesc",
    "description",
    "category",
    "formattedAddr",
    "customAddress",
    "phone",
    "website",
    "instagramHandle",
    "ageTags",
    "visitFormats",
    "activityTypes",
    "placeGroupId",
  ];

  // Check if any field has changed
  for (const field of fieldsToCompare) {
    if (hasChanged(originalPlace[field], currentPlace[field])) {
      return true;
    }
  }

  // Check images
  const oldImageUrls = new Set(originalPlace.images.map((img) => img.url));
  const newImageUrls = new Set(currentPlace.images.map((img) => img.url));

  // Check if images were added or removed
  if (oldImageUrls.size !== newImageUrls.size) {
    return true;
  }

  // Check if any image URL is different
  for (const url of newImageUrls) {
    if (!oldImageUrls.has(url)) {
      return true;
    }
  }

  // Check opening hours changes
  if (currentOpeningHours || originalOpeningHours) {
    // If one is null and the other isn't, there's a change
    if (!currentOpeningHours !== !originalOpeningHours) {
      return true;
    }

    // If both exist, normalize and compare them
    if (currentOpeningHours && originalOpeningHours) {
      const normalizedCurrent = normalizeOpeningHours(currentOpeningHours);
      const normalizedOriginal = normalizeOpeningHours(originalOpeningHours);
      
      if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedOriginal)) {
        return true;
      }
    }
  }

  return false;
}
