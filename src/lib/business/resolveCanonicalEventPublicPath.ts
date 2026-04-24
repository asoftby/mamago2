import prisma from "@/lib/prisma";
import { canonicalPublicActivityPath } from "@/lib/business/eventPublicLink";
import { findActivityBySlug } from "@/lib/slug/activitySlugService";
import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";

async function citySlugById(cityId: string | null | undefined): Promise<string | null> {
  const id = typeof cityId === "string" ? cityId.trim() : "";
  if (!id) return null;
  const city = await prisma.city.findUnique({
    where: { id },
    select: { slug: true },
  });
  return city?.slug ?? null;
}

export async function resolveCanonicalEventPublicPathById(
  activityId: string,
): Promise<string | null> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      slug: true,
      cityId: true,
      place: {
        select: {
          city: { select: { slug: true } },
        },
      },
      venue: {
        select: {
          cityId: true,
          place: {
            select: {
              city: { select: { slug: true } },
            },
          },
        },
      },
    },
  });

  if (!activity) return null;

  const activityCitySlug = await citySlugById(activity.cityId);
  const venueCitySlug =
    activity.venue?.place?.city?.slug ??
    (await citySlugById(activity.venue?.cityId));

  return canonicalPublicActivityPath({
    activityId: activity.id,
    activitySlug: activity.slug,
    activityCitySlug,
    placeCitySlug: activity.place?.city?.slug ?? null,
    venueCitySlug,
  });
}

export async function resolveCanonicalEventPublicPathBySlugOrId(
  slugOrId: string,
): Promise<string | null> {
  const bySlug = await findActivityBySlug(slugOrId);
  const resolvedId = bySlug?.activityId ?? slugOrId;
  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const activity = await prisma.activity.findFirst({
    where: {
      AND: [{ id: resolvedId }, { type: ActivityType.EVENT }, ...pubParts],
    },
    select: {
      id: true,
      slug: true,
      city: { select: { slug: true } },
      cityId: true,
      place: { select: { city: { select: { slug: true } } } },
      venue: {
        select: {
          cityId: true,
          place: { select: { city: { select: { slug: true } } } },
        },
      },
    },
  });

  if (!activity) return null;

  const activityCitySlug = activity.city?.slug ?? (await citySlugById(activity.cityId));
  const venueCitySlug =
    activity.venue?.place?.city?.slug ?? (await citySlugById(activity.venue?.cityId));

  return canonicalPublicActivityPath({
    activityId: activity.id,
    activitySlug: activity.slug,
    activityCitySlug,
    placeCitySlug: activity.place?.city?.slug ?? null,
    venueCitySlug,
  });
}
