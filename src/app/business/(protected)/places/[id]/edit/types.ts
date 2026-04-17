import type { Place, PlaceImage } from "@prisma/client";

export interface PlaceWithImages extends Omit<Place, 'images'> {
  images: Array<Omit<PlaceImage, 'placeId'> & { placeId?: string; revisionId?: string }>;
  openingHours?: Record<string, unknown>;
}

// Re-export Prisma types to avoid direct imports in components
export type { Place, PlaceImage };