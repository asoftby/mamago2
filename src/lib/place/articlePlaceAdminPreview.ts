import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { resolvePlaceAddressLabel } from "@/lib/place/placeAddressLabel";

const previewSelect = {
  title: true,
  status: true,
  shortAddress: true,
  formattedAddr: true,
  lat: true,
  lng: true,
  city: { select: { name: true } },
} as const;

type PreviewPlace = Prisma.PlaceGetPayload<{ select: typeof previewSelect }>;
type PreviewClient = {
  place: {
    findUnique(args: { where: { id: string }; select: typeof previewSelect }): Promise<PreviewPlace | null>;
    findFirst(args: { where: Prisma.PlaceWhereInput; select: { id: true } }): Promise<{ id: string } | null>;
  };
};

/** Статусы «ещё не опубликовано, но место существует и редактируется» — не «недоступно». */
export const ARTICLE_PLACE_DRAFT_LIKE_STATUSES = ["DRAFT", "PENDING", "NEEDS_REVISION"] as const;

export type ArticlePlacePreviewAvailability = "public" | "draft" | "unavailable";

export function resolveArticlePlacePreviewAvailability(
  status: string,
  publicAvailable: boolean,
): ArticlePlacePreviewAvailability {
  if (publicAvailable) return "public";
  return (ARTICLE_PLACE_DRAFT_LIKE_STATUSES as readonly string[]).includes(status) ? "draft" : "unavailable";
}

/**
 * Превью для редактора статьи: вызывается только из admin-маршрута (ADMIN/MODERATOR),
 * поэтому неопубликованное место видно автору. Публичные страницы это не используют.
 */
export async function loadArticlePlaceAdminPreview(id: string, client: PreviewClient = prisma) {
  const [place, publicPlace] = await Promise.all([
    client.place.findUnique({ where: { id }, select: previewSelect }),
    client.place.findFirst({
      where: { AND: [{ id }, getPublicPublishedPlaceWhere()] },
      select: { id: true },
    }),
  ]);
  if (!place) return null;
  return {
    entityType: "PLACE" as const,
    title: place.title,
    city: place.city?.name ?? null,
    address: resolvePlaceAddressLabel(place),
    publicAvailable: publicPlace != null,
    availability: resolveArticlePlacePreviewAvailability(place.status, publicPlace != null),
  };
}
