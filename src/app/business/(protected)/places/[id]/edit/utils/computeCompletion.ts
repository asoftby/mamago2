import type { Place } from "@prisma/client";

interface PlaceImage {
  id: string;
  createdAt: Date;
  url: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  kind: string;
  sortOrder: number;
  placeId?: string;
  revisionId?: string;
}

interface PlaceWithImages extends Omit<Place, 'images'> {
  images: PlaceImage[];
}

/**
 * Compute draft completion percentage based on filled fields
 * 
 * Weights:
 * - Step 1 (Profile): 30%
 *   - title (required): 15%
 *   - shortDesc (required): 10%
 *   - category (required): 5%
 * 
 * - Step 2 (Location): 30%
 *   - lat/lng (required): 20%
 *   - formattedAddr or customAddress: 10%
 * 
 * - Step 3 (Photos): 20%
 *   - logo (required): 15%
 *   - gallery (>=1 photo): 5%
 * 
 * - Step 4 (Contacts): 20%
 *   - phone: 10%
 *   - website or instagram: 5%
 *   - any additional contact: 5%
 * 
 * @returns percentage 0-100
 */
export function computePlaceDraftCompletion(place: PlaceWithImages): number {
  let completion = 0;

  // Step 1: Profile (30%)
  if (place.title && place.title.trim().length > 0) {
    completion += 15;
  }
  if (place.shortDesc && place.shortDesc.trim().length > 0) {
    completion += 10;
  }
  if (place.category && place.category.trim().length > 0) {
    completion += 5;
  }

  // Step 2: Location (30%)
  if (place.lat !== null && place.lng !== null) {
    completion += 20;
  }
  if (place.formattedAddr || place.customAddress) {
    completion += 10;
  }

  // Step 3: Photos (20%)
  const hasLogo = !!place.logoImageId && place.images.some((img) => img.kind === "LOGO");
  if (hasLogo) {
    completion += 15;
  }
  const hasGallery = place.images.some((img) => img.kind === "GALLERY");
  if (hasGallery) {
    completion += 5;
  }

  // Step 4: Contacts (20%)
  if (place.phone && place.phone.trim().length > 0) {
    completion += 10;
  }
  if (place.website && place.website.trim().length > 0) {
    completion += 5;
  }
  if (place.instagramHandle && place.instagramHandle.trim().length > 0) {
    completion += 5;
  }

  // Clamp to 0-100
  return Math.min(100, Math.max(0, completion));
}
