import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay, subDays } from "date-fns";

export function resolveAnalyticsDateRange(
  dateRange: AnalyticsOverviewDateRange,
): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);
  let start: Date;
  switch (dateRange) {
    case "today":
      start = startOfDay(now);
      break;
    case "7d":
      start = startOfDay(subDays(now, 6));
      break;
    case "30d":
      start = startOfDay(subDays(now, 29));
      break;
    case "90d":
      start = startOfDay(subDays(now, 89));
      break;
    case "1y":
      start = startOfDay(subDays(now, 364));
      break;
    default:
      start = startOfDay(subDays(now, 29));
  }
  return { start, end };
}

export async function resolveCityIdFromSlug(slug: string): Promise<string | null> {
  if (!slug.trim()) return null;
  const row = await prisma.city.findUnique({
    where: { slug: slug.trim() },
    select: { id: true },
  });
  return row?.id ?? null;
}
