import { ActivityType, ContentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicActivityDetailWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import type { ActivityForEventPageInput } from "@/lib/event/buildEventPageDataFromPrisma";
import { findActivityBySlug } from "@/lib/slug/activitySlugService";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { enrichPlaceWithResolvedLogo } from "@/lib/place/resolvePlaceLogoUrlFromDb";

/**
 * Публичная карточка события по `/{city}/events/{slug|id}` (опубликовано и в городе).
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
      status: ContentStatus;
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
      ownerUserId: string;
      _redirectToSlug?: string;
    })
  | null
> {
  const city = await findCityBySlug(citySlug);
  if (!city) return null;

  const now = new Date();

  // Resolve slug → activityId (current or history)
  const bySlug = await findActivityBySlug(slugOrId);
  const resolvedId = bySlug?.activityId ?? slugOrId;

  const pub = getPublicActivityDetailWhere();
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
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, mediaAssetId: true },
      },
      sessions: {
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
      },
      // SEO fields are scalar fields on Activity, included automatically.
      place: {
        select: {
          id: true,
          slug: true,
          title: true,
          formattedAddr: true,
          customAddress: true,
          lat: true,
          lng: true,
          logoImageId: true,
          images: { select: { id: true, url: true, kind: true }, orderBy: { sortOrder: "asc" } },
          districtManual: { select: { name: true } },
          districtAuto: { select: { name: true } },
          metroManual: { select: { name: true } },
          metroAuto: { select: { name: true } },
          city: { select: { slug: true } },
        },
      },
      venue: {
        include: {
          place: {
            select: {
              id: true,
              slug: true,
              title: true,
              formattedAddr: true,
              customAddress: true,
              lat: true,
              lng: true,
              logoImageId: true,
              images: { select: { id: true, url: true, kind: true }, orderBy: { sortOrder: "asc" } },
              districtManual: { select: { name: true } },
              districtAuto: { select: { name: true } },
              metroManual: { select: { name: true } },
              metroAuto: { select: { name: true } },
              city: { select: { slug: true } },
            },
          },
        },
      },
      eventCategory: { select: { nameRu: true } },
    },
  });

  if (!activity) return null;

  const [place, venuePlace] = await Promise.all([
    enrichPlaceWithResolvedLogo(activity.place),
    enrichPlaceWithResolvedLogo(activity.venue?.place ?? null),
  ]);

  const redirectToSlug =
    activity.slug && slugOrId !== activity.slug ? activity.slug : undefined;

  return {
    cityId: city.id,
    id: activity.id,
    status: activity.status,
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
    format: activity.format,
    ageTags: activity.ageTags,
    priceText: activity.priceText,
    priceFrom: activity.priceFrom,
    currency: activity.currency,
    priceDetails: activity.priceDetails,
    scheduleJson: activity.scheduleJson,
    coverImageId: activity.coverImageId,
    coverImageUrl: resolveActivityCoverUrl({
      coverImageId: activity.coverImageId,
      coverImageUrl: activity.coverImageUrl,
      images: activity.images.map((img) => ({
        id: img.id,
        url: img.url,
        mediaAssetId: img.mediaAssetId,
      })),
    }),
    images: activity.images.map((img) => ({ id: img.id, url: img.url })),
    sessions: activity.sessions.map((s) => ({ id: s.id, startsAt: s.startsAt })),
    place: place
      ? {
          id: place.id,
          slug: place.slug,
          title: place.title,
          formattedAddr: place.formattedAddr,
          customAddress: place.customAddress,
          lat: place.lat,
          lng: place.lng,
          logoImageId: place.logoImageId,
          logoUrl: place.logoUrl,
          images: place.images,
          districtManual: place.districtManual,
          districtAuto: place.districtAuto,
          metroManual: place.metroManual,
          metroAuto: place.metroAuto,
          city: place.city,
        }
      : null,
    venue: activity.venue
      ? {
          kind: activity.venue.kind,
          title: activity.venue.title,
          addressLine: activity.venue.addressLine,
          place: venuePlace
            ? {
                id: venuePlace.id,
                slug: venuePlace.slug,
                title: venuePlace.title,
                formattedAddr: venuePlace.formattedAddr,
                customAddress: venuePlace.customAddress,
                lat: venuePlace.lat,
                lng: venuePlace.lng,
                logoImageId: venuePlace.logoImageId,
                logoUrl: venuePlace.logoUrl,
                images: venuePlace.images,
                districtManual: venuePlace.districtManual,
                districtAuto: venuePlace.districtAuto,
                metroManual: venuePlace.metroManual,
                metroAuto: venuePlace.metroAuto,
                city: venuePlace.city,
              }
            : null,
        }
      : null,
    eventCategory: activity.eventCategory,
    ownerUserId: activity.ownerUserId,
    ...(redirectToSlug ? { _redirectToSlug: redirectToSlug } : {}),
  };
}
