import { prisma } from "@/lib/prisma";

export type ActivityAnalyticsContext = {
  cityId: string | null;
  /** EventCategory.slug (publicationType EVENT), for analytics taxonomy meta. */
  eventCategorySlug: string | null;
};

/**
 * Город + taxonomy для аналитики по активности (место / legacy cityId на
 * Activity, EventCategory.slug). Один lookup — используется на domain-
 * transition событиях (SAVE/PLAN_ADD), где Activity и так нужно читать.
 */
export async function getActivityAnalyticsContext(
  activityId: string,
): Promise<ActivityAnalyticsContext> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      cityId: true,
      place: { select: { cityId: true } },
      eventCategory: { select: { slug: true } },
    },
  });
  if (!a) return { cityId: null, eventCategorySlug: null };
  return {
    cityId: a.place?.cityId ?? a.cityId ?? null,
    eventCategorySlug: a.eventCategory?.slug ?? null,
  };
}
