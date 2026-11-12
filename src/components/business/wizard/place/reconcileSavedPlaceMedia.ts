import type { PlaceFormData, PlaceImage } from "./types";

export type SavedPlaceMedia = {
  logoImageId: string | null;
  images: PlaceImage[];
};

/**
 * After PATCH, TempMedia identifiers are no longer valid: the server has
 * converted the selected files to PlaceImage records. Use the server result
 * for both the current editor state and its clean baseline.
 */
export function reconcileSavedPlaceMedia(
  current: PlaceFormData,
  persisted: SavedPlaceMedia,
): PlaceFormData {
  const logo = persisted.images.find(
    (image) => image.kind === "LOGO" && image.id === persisted.logoImageId,
  );
  return {
    ...current,
    logoImageId: persisted.logoImageId,
    logoUrl: logo?.url ?? null,
    images: persisted.images.map((image) => ({ ...image })),
    tempLogoMediaId: null,
    tempGalleryMediaIds: [],
  };
}
