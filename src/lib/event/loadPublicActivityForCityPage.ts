import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import type { ActivityForEventPageInput } from "@/lib/event/buildEventPageDataFromPrisma";

/**
 * Публичная карточка события по `/{city}/activity/{id}` (опубликовано и в городе).
 */
export async function loadPublicActivityForCityPage(
  citySlug: string,
  activityId: string,
): Promise<ActivityForEventPageInput | null> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) return null;

  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const where: Prisma.ActivityWhereInput = {
    AND: [
      { id: activityId },
      { type: ActivityType.EVENT },
      activityInCityWhere(city.id),
      ...pubParts,
    ],
  };

  const activity = await prisma.activity.findFirst({
    where,
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      sessions: { orderBy: { startsAt: "asc" } },
      place: {
        select: {
          title: true,
          formattedAddr: true,
          city: { select: { slug: true } },
        },
      },
      venue: {
        include: {
          place: {
            select: { title: true, formattedAddr: true },
          },
        },
      },
      eventCategory: { select: { nameRu: true } },
    },
  });

  if (!activity) return null;

  return {
    id: activity.id,
    title: activity.title,
    shortDesc: activity.shortDesc,
    description: activity.description,
    ageTags: activity.ageTags,
    priceText: activity.priceText,
    priceFrom: activity.priceFrom,
    currency: activity.currency,
    priceDetails: activity.priceDetails,
    coverImageUrl: activity.coverImageUrl ?? activity.images[0]?.url ?? null,
    images: activity.images.map((img) => ({ id: img.id, url: img.url })),
    sessions: activity.sessions.map((s) => ({ id: s.id, startsAt: s.startsAt })),
    place: activity.place
      ? {
          title: activity.place.title,
          formattedAddr: activity.place.formattedAddr,
          city: activity.place.city,
        }
      : null,
    venue: activity.venue
      ? {
          kind: activity.venue.kind,
          title: activity.venue.title,
          addressLine: activity.venue.addressLine,
          place: activity.venue.place
            ? {
                title: activity.venue.place.title,
                formattedAddr: activity.venue.place.formattedAddr,
              }
            : null,
        }
      : null,
    eventCategory: activity.eventCategory,
  };
}
