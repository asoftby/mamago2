import { prisma } from "@/lib/prisma";

/**
 * Город для аналитики по активности (место / legacy cityId на Activity).
 */
export async function getActivityCityIdForAnalytics(
  activityId: string,
): Promise<string | null> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      cityId: true,
      place: { select: { cityId: true } },
    },
  });
  if (!a) return null;
  return a.place?.cityId ?? a.cityId ?? null;
}
