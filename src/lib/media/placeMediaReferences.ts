export type PlaceMediaReferenceInput = {
  field: "logo" | "gallery";
  reference: string;
  placeImageId: string | null;
  order: number;
};

export function collectPlaceMediaReferenceInputs(place: {
  logoImageId: string | null;
  images: Array<{ id: string; kind: "LOGO" | "GALLERY"; url: string; sortOrder?: number }>;
}): PlaceMediaReferenceInput[] {
  const result: PlaceMediaReferenceInput[] = [];
  if (place.logoImageId) {
    const logoImage = place.images.find((image) => image.id === place.logoImageId && image.kind === "LOGO");
    result.push({ field: "logo", reference: logoImage?.url ?? place.logoImageId, placeImageId: logoImage?.id ?? null, order: 0 });
  }
  place.images
    .filter((image) => image.kind === "GALLERY")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .forEach((image, index) => result.push({ field: "gallery", reference: image.url, placeImageId: image.id, order: index + 1 }));
  return result;
}
