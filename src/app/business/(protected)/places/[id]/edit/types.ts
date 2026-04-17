import type { Place, PlaceImage } from "@prisma/client";
import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";

export interface PlaceWithImages extends Omit<Place, 'images'> {
  images: Array<Omit<PlaceImage, 'placeId'> & { placeId?: string; revisionId?: string }>;
  openingHours?: OpeningHoursData | null;
  _districtName?: string | undefined;
  _metroName?: string | undefined;
  _cityName?: string | undefined;
}

// Re-export Prisma types to avoid direct imports in components
export type { Place, PlaceImage };