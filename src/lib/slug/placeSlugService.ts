/**
 * Place Slug Service
 * Manages slug generation with stable, SEO-friendly logic
 * 
 * KEY PRINCIPLES:
 * - Slug is assigned ONCE when place is first published
 * - Slug NEVER changes automatically (even if title/address changes)
 * - First place with unique name gets short slug: "pugovka"
 * - Duplicate names get street-based slug: "pugovka-na-vostochnoy"
 * - Existing slugs are NEVER recalculated
 */

import { prisma } from "@/lib/prisma";
import { slugifyRu } from "@/lib/slugify";
import { createPlaceSlugHistoryIgnoreDuplicate } from "@/lib/slug/slugHistoryDedupe";
import { syncPlaceCanonical } from "@/lib/seo/syncEntityCanonical";
import {
  normalizePlaceName,
  buildBasePlaceSlug,
  buildAddressPlaceSlug,
  addNumericSuffix,
} from "./slugUtils";

export interface PlaceForSlug {
  id: string;
  title: string;
  cityId: string | null;
  formattedAddr?: string | null;
  customAddress?: string | null;
  shortAddress?: string | null;
  slug?: string | null;
}

/**
 * Check if slug is available (not used by any place or in history)
 */
async function isSlugAvailable(slug: string, excludePlaceId?: string, cityId?: string | null): Promise<boolean> {
  // Check current places
  const existingPlace = await prisma.place.findFirst({
    where: { slug, ...(cityId ? { cityId } : {}) },
    select: { id: true },
  });

  if (existingPlace && existingPlace.id !== excludePlaceId) {
    return false;
  }

  // Check slug history
  const historyEntry = await prisma.placeSlugHistory.findFirst({
    where: { slug, ...(cityId ? { cityId } : {}) },
    select: { placeId: true },
  });

  if (historyEntry && historyEntry.placeId !== excludePlaceId) {
    return false;
  }

  return true;
}

/**
 * Ensure slug is unique by adding numeric suffix if needed
 * Only used as last resort fallback
 */
async function ensureUniquePlaceSlug(
  candidateSlug: string,
  excludePlaceId?: string,
  cityId?: string | null,
): Promise<string> {
  let slug = candidateSlug;
  let suffix = 2;

  while (!(await isSlugAvailable(slug, excludePlaceId, cityId))) {
    slug = addNumericSuffix(candidateSlug, suffix);
    suffix++;

    if (suffix > 100) {
      throw new Error(`Could not generate unique slug for: ${candidateSlug}`);
    }
  }

  return slug;
}

/**
 * Check if there are other PUBLISHED places with the same normalized name in the same city
 * (excluding the current place)
 */
async function hasNameConflictInCity(
  title: string,
  cityId: string | null,
  excludePlaceId?: string
): Promise<boolean> {
  const normalizedName = normalizePlaceName(title);
  
  // Get all published places in the same city
  const places = await prisma.place.findMany({
    where: {
      cityId: cityId || null,
      status: "PUBLISHED",
      archivedAt: null,
      id: excludePlaceId ? { not: excludePlaceId } : undefined,
    },
    select: {
      id: true,
      title: true,
    },
  });
  
  // Check if any have the same normalized name
  return places.some(
    (place) => normalizePlaceName(place.title) === normalizedName
  );
}

/**
 * Generate optimal slug for a NEW place
 * 
 * Strategy:
 * 1. Check if name is unique in city
 * 2. If unique → use base slug (e.g., "pugovka")
 * 3. If duplicate → use address-based slug (e.g., "pugovka-na-vostochnoy")
 * 4. If still conflicts → add numeric suffix as fallback
 * 
 * IMPORTANT: This is only called ONCE when place is first published
 */
export async function generatePlaceSlug(place: PlaceForSlug): Promise<string> {
  // Check if there are other places with same name in same city
  const hasConflict = await hasNameConflictInCity(
    place.title,
    place.cityId,
    place.id
  );
  
  let candidateSlug: string;
  
  if (!hasConflict) {
    // Unique name in city → use short base slug
    candidateSlug = buildBasePlaceSlug(place);
    console.log(`[Slug] Unique name in city, using base slug: ${candidateSlug}`);
  } else {
    // Duplicate name exists → use address-based slug
    candidateSlug = buildAddressPlaceSlug(place);
    console.log(`[Slug] Duplicate name detected, using address slug: ${candidateSlug}`);
  }
  
  // Ensure uniqueness (adds numeric suffix if needed)
  const finalSlug = await ensureUniquePlaceSlug(candidateSlug, place.id, place.cityId);
  
  if (finalSlug !== candidateSlug) {
    console.log(`[Slug] Added numeric suffix: ${finalSlug}`);
  }
  
  return finalSlug;
}

/**
 * Update place slug and save old slug to history
 * Handles the transaction safely
 * 
 * NOTE: This should only be called by admins/moderators, not automatically
 */
export async function updatePlaceSlug(
  placeId: string,
  newSlug: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Get current place
    const place = await tx.place.findUnique({
      where: { id: placeId },
      select: { slug: true, cityId: true },
    });
    
    if (!place) {
      throw new Error(`Place not found: ${placeId}`);
    }
    
    // If slug hasn't changed, do nothing
    if (place.slug === newSlug) {
      console.log(`[Slug] No change needed for place ${placeId}`);
      return;
    }

    // Save old slug to history (if it exists)
    if (place.slug) {
      await createPlaceSlugHistoryIgnoreDuplicate(tx, placeId, place.slug, place.cityId);
      console.log(`[Slug] Saved old slug to history: ${place.slug}`);
    } else {
      await createPlaceSlugHistoryIgnoreDuplicate(tx, placeId, placeId, place.cityId);
    }
    
    // Update place with new slug
    await tx.place.update({
      where: { id: placeId },
      data: {
        slug: newSlug,
        slugUpdatedAt: new Date(),
      },
    });
    
    console.log(`[Slug] Updated place ${placeId} slug: ${place.slug} → ${newSlug}`);
  });
  await syncPlaceCanonical(placeId);
}

/**
 * Assign slug to a place when it's first published
 * 
 * IMPORTANT: This is the ONLY time slug is automatically assigned
 * After this, slug remains stable even if title/address changes
 */
export async function assignSlugOnPublish(placeId: string): Promise<string> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: {
      id: true,
      title: true,
      cityId: true,
      formattedAddr: true,
      customAddress: true,
      shortAddress: true,
      slug: true,
    },
  });
  
  if (!place) {
    throw new Error(`Place not found: ${placeId}`);
  }
  
  // If place already has a slug, don't change it
  if (place.slug) {
    console.log(`[Slug] Place ${placeId} already has slug: ${place.slug}`);
    return place.slug;
  }
  
  // Generate new slug
  const newSlug = await generatePlaceSlug(place);
  
  await prisma.$transaction(async (tx) => {
    await createPlaceSlugHistoryIgnoreDuplicate(tx, placeId, placeId, place.cityId);
    await tx.place.update({
      where: { id: placeId },
      data: {
        slug: newSlug,
        slugUpdatedAt: new Date(),
      },
    });
  });

  console.log(`[Slug] Assigned slug to place ${placeId}: ${newSlug}`);
  await syncPlaceCanonical(placeId);
  return newSlug;
}

/**
 * Assign slug when title is first filled (idempotent).
 * This is used for drafts so public/admin URLs can exist early.
 * If slug already exists — does nothing.
 */
export async function assignPlaceSlugIfMissing(placeId: string, title: string): Promise<string> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, slug: true, cityId: true },
  });
  if (!place) throw new Error(`Place not found: ${placeId}`);
  if (place.slug) return place.slug;

  const base = slugifyRu(title || "place");
  let slug = base;
  let i = 2;
  while (!(await isSlugAvailable(slug, placeId, place.cityId))) {
    slug = `${base}-${i}`;
    i++;
    if (i > 200) throw new Error(`Could not generate unique place slug for: ${base}`);
  }

  await prisma.$transaction(async (tx) => {
    await createPlaceSlugHistoryIgnoreDuplicate(tx, placeId, placeId, place.cityId);
    await tx.place.update({
      where: { id: placeId },
      data: { slug, slugUpdatedAt: new Date() },
      select: { id: true },
    });
  });
  await syncPlaceCanonical(placeId);
  return slug;
}

/**
 * Find place by slug (current or historical)
 * Returns place ID and whether it's a redirect
 */
export async function findPlaceBySlug(slug: string): Promise<{
  placeId: string;
  isRedirect: boolean;
} | null> {
  // First, try to find by current slug
  const place = await prisma.place.findFirst({
    where: { slug },
    select: { id: true },
  });

  if (place) {
    return {
      placeId: place.id,
      isRedirect: false,
    };
  }

  // Not found in current slugs, check history
  const historyEntry = await prisma.placeSlugHistory.findFirst({
    where: { slug },
    select: { placeId: true },
  });
  
  if (historyEntry) {
    return {
      placeId: historyEntry.placeId,
      isRedirect: true,
    };
  }
  
  // Not found anywhere
  return null;
}

/**
 * City-scoped variant of `findPlaceBySlug` — the canonical `/{city}/places/{slug}`
 * route must use this, not the global lookup above: `Place.slug` is only
 * unique per-city (`@@unique([cityId, slug])`), so a global `findFirst` can
 * silently resolve to the wrong city's Place once two cities happen to
 * generate the same slug. Scoping by `cityId` here closes that gap for the
 * canonical page; the global `findPlaceBySlug` remains in use only for the
 * legacy `/places/{slug}` redirect resolver, which must find a place before
 * it can know which city to redirect to.
 */
export async function findPlaceBySlugInCity(
  cityId: string,
  slug: string,
): Promise<{ placeId: string; isRedirect: boolean } | null> {
  const place = await prisma.place.findFirst({
    where: { slug, cityId },
    select: { id: true },
  });
  if (place) {
    return { placeId: place.id, isRedirect: false };
  }

  const historyEntry = await prisma.placeSlugHistory.findFirst({
    where: { slug, cityId },
    select: { placeId: true },
  });
  if (historyEntry) {
    return { placeId: historyEntry.placeId, isRedirect: true };
  }

  return null;
}
