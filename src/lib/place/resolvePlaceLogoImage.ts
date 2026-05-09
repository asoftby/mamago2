export type PlaceImageLike = { id: string; url: string; kind: string };

/**
 * Логотип места: сначала снимок с id === place.logoImageId (если есть в списке),
 * иначе первое изображение с kind === "LOGO".
 * Учитывает рассинхрон (временный id в logoImageId, лого помечено иначе и т.д.).
 */
export function resolvePlaceLogoImage(
  images: PlaceImageLike[] | null | undefined,
  logoImageId: string | null | undefined,
): PlaceImageLike | null {
  if (!images?.length) {
    return null;
  }
  const lid = typeof logoImageId === "string" ? logoImageId.trim() : "";
  if (lid) {
    const byId = images.find((img) => img.id === lid);
    if (byId?.url?.trim()) {
      return byId;
    }
  }
  const byKind = images.find((img) => img.kind === "LOGO");
  return byKind?.url?.trim() ? byKind : null;
}
