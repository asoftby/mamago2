import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";

const previewSelect = {
  title: true,
  shortAddress: true,
  formattedAddr: true,
  city: { select: { name: true } },
} as const;

type PreviewPlace = Prisma.PlaceGetPayload<{ select: typeof previewSelect }>;
type PreviewClient = {
  place: {
    findUnique(args: { where: { id: string }; select: typeof previewSelect }): Promise<PreviewPlace | null>;
    findFirst(args: { where: Prisma.PlaceWhereInput; select: { id: true } }): Promise<{ id: string } | null>;
  };
};

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
    address: place.shortAddress ?? place.formattedAddr ?? null,
    publicAvailable: publicPlace != null,
  };
}
