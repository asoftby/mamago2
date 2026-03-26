import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import type { ActivityForEventPageInput } from "@/lib/event/buildEventPageDataFromPrisma";
import { findActivityBySlug } from "@/lib/slug/activitySlugService";

/**
 * Публичная карточка события по `/{city}/activity/{slug}` (опубликовано и в городе).
 * Поддерживает:
 * - current slug
 * - old slug history (for redirect)
 * - legacy id (for redirect)
 */
export async function loadPublicActivityForCityPage(
  citySlug: string,
  slugOrId: string,
): Promise<
  | (ActivityForEventPageInput & {
      slug: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      seoH1: string | null;
      seoCanonicalUrl: string | null;
      seoOgTitle: string | null;
      seoOgDescription: string | null;
      seoOgImage: string | null;
      seoRobots: string | null;
      seoJsonLdOverride: unknown | null;
      _redirectToSlug?: string;
    })
  | null
> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) return null;

  // Resolve slug → activityId (current or history)
  const bySlug = await findActivityBySlug(slugOrId);
  const resolvedId = bySlug?.activityId ?? slugOrId;

  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const where: Prisma.ActivityWhereInput = {
    AND: [
      { id: resolvedId },
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
      // SEO fields are scalar fields on Activity, included automatically.
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

  const redirectToSlug =
    activity.slug && slugOrId !== activity.slug ? activity.slug : undefined;

  return {
    id: activity.id,
    slug: activity.slug,
    seoTitle: activity.seoTitle,
    seoDescription: activity.seoDescription,
    seoH1: activity.seoH1,
    seoCanonicalUrl: activity.seoCanonicalUrl,
    seoOgTitle: activity.seoOgTitle,
    seoOgDescription: activity.seoOgDescription,
    seoOgImage: activity.seoOgImage,
    seoRobots: activity.seoRobots,
    seoJsonLdOverride: (activity.seoJsonLdOverride as unknown) ?? null,
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
    ...(redirectToSlug ? { _redirectToSlug: redirectToSlug } : {}),
  };
}
