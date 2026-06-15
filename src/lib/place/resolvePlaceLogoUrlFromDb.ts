import "server-only";

import prisma from "@/lib/prisma";
import { isMediaAssetCuid } from "@/lib/media/isMediaAssetCuid";
import {
  resolvePlaceLogoUrl,
  type PlaceImageLike,
} from "@/lib/place/resolvePlaceLogoImage";

/**
 * Логотип места для публичных страниц: PlaceImage + fallback на MediaAsset по logoImageId.
 */
export async function resolvePlaceLogoUrlFromDb(
  images: PlaceImageLike[] | null | undefined,
  logoImageId: string | null | undefined,
): Promise<string | undefined> {
  const direct = resolvePlaceLogoUrl(images, logoImageId);
  if (direct) return direct;

  const lid = typeof logoImageId === "string" ? logoImageId.trim() : "";
  if (!lid || !isMediaAssetCuid(lid)) return undefined;

  const logoAsset = await prisma.mediaAsset.findUnique({
    where: { id: lid },
    select: { publicUrl: true },
  });

  return logoAsset?.publicUrl?.trim() || undefined;
}

export async function enrichPlaceWithResolvedLogo<
  T extends {
    images?: PlaceImageLike[] | null;
    logoImageId?: string | null;
  },
>(place: T | null): Promise<(T & { logoUrl?: string }) | null> {
  if (!place) return null;

  const logoUrl = await resolvePlaceLogoUrlFromDb(place.images, place.logoImageId);
  return logoUrl ? { ...place, logoUrl } : place;
}
