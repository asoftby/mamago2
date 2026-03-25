import prisma from "@/lib/prisma";

type ScheduleJsonLike = {
  dates?: unknown;
  startTime?: unknown;
};

/**
 * Replaces ActivitySession rows from wizard scheduleJson (dates + time).
 * Required for submit validation and listings that rely on sessions.
 */
export async function replaceActivitySessionsFromScheduleJson(
  activityId: string,
  scheduleJson: unknown,
): Promise<number> {
  const j = scheduleJson as ScheduleJsonLike | null | undefined;
  const dates =
    j && Array.isArray(j.dates)
      ? (j.dates as string[]).filter(
          (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
        )
      : [];

  const startTime =
    typeof j?.startTime === "string" && /^\d{2}:\d{2}$/.test(j.startTime)
      ? j.startTime
      : "10:00";

  await prisma.activitySession.deleteMany({ where: { activityId } });

  if (dates.length === 0) {
    return 0;
  }

  const startsAtList: Date[] = [];
  for (const dateStr of dates) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    startsAtList.push(new Date(y, m - 1, d, hh, mm, 0, 0));
  }

  await prisma.activitySession.createMany({
    data: startsAtList.map((startsAt) => ({ activityId, startsAt })),
  });

  return startsAtList.length;
}
