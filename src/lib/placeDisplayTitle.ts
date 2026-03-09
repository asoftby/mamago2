/**
 * Place Display Title Utilities
 * Handles how place names are shown in UI (not for slug generation)
 * 
 * Display logic:
 * - If place name is unique in city: show just "Пуговка"
 * - If duplicates exist: show "Пуговка на Ратомской"
 */

import { PrismaClient } from "@prisma/client";
import { normalizePlaceName, getStreetLabelPrepositional } from "./slug/slugUtils";

/**
 * Check if there are duplicate Place titles in the same city
 * Returns true if there are other PUBLISHED places with the same normalized title
 */
export async function hasDuplicateTitleInCity(
  prisma: PrismaClient,
  title: string,
  cityId: string | null,
  excludePlaceId?: string
): Promise<boolean> {
  if (!cityId) return false;

  const normalizedTitle = normalizePlaceName(title);

  const duplicates = await prisma.place.findMany({
    where: {
      cityId,
      id: excludePlaceId ? { not: excludePlaceId } : undefined,
      status: "PUBLISHED", // Only check published places
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
    },
  });

  // Check if any duplicate has the same normalized title
  return duplicates.some((place) => normalizePlaceName(place.title) === normalizedTitle);
}

/**
 * Get display title for a Place in UI
 * - If title is unique in city: return "Пуговка"
 * - If title has duplicates in city: return "Пуговка на Ратомской"
 * - If no street available: fallback to "Пуговка — [address]"
 * 
 * NOTE: This is for UI display only, NOT for slug generation
 */
export function getDisplayTitle(
  title: string,
  formattedAddr: string | null,
  customAddress: string | null,
  shortAddress: string | null,
  hasDuplicates: boolean
): string {
  if (!hasDuplicates) {
    return title;
  }

  // Get street label in prepositional case for "на" construction
  const streetPrepositional = getStreetLabelPrepositional(
    formattedAddr,
    customAddress,
    shortAddress
  );
  
  if (streetPrepositional) {
    return `${title} на ${streetPrepositional}`;
  }

  // Fallback: use shortAddress or formattedAddr with em dash
  // Only use fallback if we have some address info
  const fallbackAddress = shortAddress || formattedAddr;
  if (fallbackAddress) {
    return `${title} — ${fallbackAddress}`;
  }
  
  // Last resort: just title with location indicator
  return `${title} — другой локации`;
}

/**
 * Get display title for a Place (async version with duplicate check)
 */
export async function getPlaceDisplayTitle(
  prisma: PrismaClient,
  place: {
    id: string;
    title: string;
    formattedAddr: string | null;
    customAddress: string | null;
    shortAddress: string | null;
    cityId: string | null;
  }
): Promise<string> {
  const hasDuplicates = await hasDuplicateTitleInCity(
    prisma,
    place.title,
    place.cityId,
    place.id
  );

  return getDisplayTitle(
    place.title,
    place.formattedAddr,
    place.customAddress,
    place.shortAddress,
    hasDuplicates
  );
}
