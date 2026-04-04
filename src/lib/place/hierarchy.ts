/**
 * Place Hierarchy Helpers
 * Functions for working with Complex → Unit relationships
 */

import prisma from "@/lib/prisma";
import { PlaceKind, ContentStatus, LocationSource } from "@prisma/client";
import type { Place } from "@prisma/client";
import { getUserBusinessId } from "@/lib/auth/placeAccess";

/**
 * Check if a place is a complex (shopping mall, park, etc.)
 */
export function isComplex(place: Place): boolean {
  return place.placeKind === PlaceKind.COMPLEX;
}

/**
 * Check if a place is a unit inside a complex
 */
export function isUnit(place: Place): boolean {
  return place.placeKind === PlaceKind.UNIT;
}

/**
 * Check if a place is standalone (not part of hierarchy)
 */
export function isStandalone(place: Place): boolean {
  return place.placeKind === PlaceKind.STANDALONE;
}

/**
 * Check for duplicate place by googlePlaceId
 * Returns information about existing place and recommended action
 */
export async function checkDuplicatePlace(googlePlaceId: string) {
  const existing = await prisma.place.findFirst({
    where: { googlePlaceId },
    select: {
      id: true,
      title: true,
      placeKind: true,
      formattedAddr: true,
      status: true,
    },
  });

  if (!existing) {
    return {
      isDuplicate: false,
      action: "CREATE_NEW" as const,
    };
  }

  if (existing.placeKind === PlaceKind.COMPLEX) {
    return {
      isDuplicate: true,
      isComplex: true,
      complexId: existing.id,
      complexTitle: existing.title,
      complexAddress: existing.formattedAddr,
      action: "CREATE_UNIT" as const,
    };
  }

  return {
    isDuplicate: true,
    isComplex: false,
    placeId: existing.id,
    placeTitle: existing.title,
    placeAddress: existing.formattedAddr,
    action: "USE_EXISTING" as const,
  };
}

/**
 * Create a unit inside a complex
 */
export async function createUnitInComplex(
  userId: string,
  complexId: string,
  data: {
    title: string;
    category: string;
    shortDesc: string;
    description?: string;
    floor: string;
    unit: string;
    phone?: string;
    website?: string;
    instagramHandle?: string;
  }
) {
  // Get complex coordinates
  const complex = await prisma.place.findUnique({
    where: { id: complexId },
    select: {
      lat: true,
      lng: true,
      placeKind: true,
    },
  });

  if (!complex) {
    throw new Error("Complex not found");
  }

  if (complex.placeKind !== PlaceKind.COMPLEX) {
    throw new Error("Parent place must be a COMPLEX");
  }

  // Generate unitLabel
  const unitLabel = `${data.floor} этаж, павильон ${data.unit}`;

  // Get user's business ID
  const businessId = await getUserBusinessId(userId);

  return await prisma.place.create({
    data: {
      createdByUserId: userId,
      ownerBusinessId: businessId,
      title: data.title,
      category: data.category,
      shortDesc: data.shortDesc,
      description: data.description,
      placeKind: PlaceKind.UNIT,
      parentPlaceId: complexId,
      floor: data.floor,
      unit: data.unit,
      unitLabel,
      lat: complex.lat,
      lng: complex.lng,
      locationSource: LocationSource.MANUAL,
      phone: data.phone,
      website: data.website,
      instagramHandle: data.instagramHandle,
      status: ContentStatus.DRAFT,
    },
  });
}

/**
 * Get all units in a complex
 */
export async function getUnitsInComplex(
  complexId: string,
  options?: {
    includeImages?: boolean;
    onlyPublished?: boolean;
  }
) {
  const { includeImages = false, onlyPublished = true } = options || {};

  return await prisma.place.findMany({
    where: {
      parentPlaceId: complexId,
      placeKind: PlaceKind.UNIT,
      ...(onlyPublished && { status: ContentStatus.PUBLISHED }),
    },
    orderBy: [{ floor: "asc" }, { unit: "asc" }],
    include: includeImages
      ? {
          images: {
            where: { kind: "LOGO" },
            take: 1,
          },
        }
      : undefined,
  });
}

/**
 * Get complex with all its units
 */
export async function getComplexWithUnits(complexId: string) {
  return await prisma.place.findUnique({
    where: { id: complexId },
    include: {
      children: {
        where: {
          placeKind: PlaceKind.UNIT,
          status: ContentStatus.PUBLISHED,
        },
        orderBy: [{ floor: "asc" }, { unit: "asc" }],
        include: {
          images: {
            where: { kind: "LOGO" },
            take: 1,
          },
        },
      },
      images: true,
    },
  });
}

/**
 * Get unit with parent complex
 */
export async function getUnitWithParent(unitId: string) {
  return await prisma.place.findUnique({
    where: { id: unitId },
    include: {
      parentPlace: {
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          lat: true,
          lng: true,
        },
      },
      images: true,
    },
  });
}

/**
 * Get coordinates for a place (inherits from parent if UNIT)
 */
export async function getPlaceCoordinates(placeId: string): Promise<{
  lat: number | null;
  lng: number | null;
}> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: {
      lat: true,
      lng: true,
      placeKind: true,
      parentPlace: {
        select: {
          lat: true,
          lng: true,
        },
      },
    },
  });

  if (!place) {
    return { lat: null, lng: null };
  }

  // UNIT inherits coordinates from parent
  if (place.placeKind === PlaceKind.UNIT && place.parentPlace) {
    return {
      lat: place.parentPlace.lat,
      lng: place.parentPlace.lng,
    };
  }

  return {
    lat: place.lat,
    lng: place.lng,
  };
}

/**
 * Validate unit data
 */
export function validateUnitData(data: {
  floor?: string;
  unit?: string;
  parentPlaceId?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.parentPlaceId) {
    errors.push("parentPlaceId is required for UNIT");
  }

  if (!data.floor || data.floor.trim().length === 0) {
    errors.push("floor is required for UNIT");
  }

  if (!data.unit || data.unit.trim().length === 0) {
    errors.push("unit is required for UNIT");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate unit label from floor and unit
 */
export function generateUnitLabel(floor: string, unit: string): string {
  return `${floor} этаж, павильон ${unit}`;
}

/**
 * Check if user can create unit in complex
 * (Complex must be published)
 */
export async function canCreateUnitInComplex(
  complexId: string
): Promise<boolean> {
  const complex = await prisma.place.findUnique({
    where: { id: complexId },
    select: {
      placeKind: true,
      status: true,
    },
  });

  if (!complex) {
    return false;
  }

  return (
    complex.placeKind === PlaceKind.COMPLEX &&
    complex.status === ContentStatus.PUBLISHED
  );
}
