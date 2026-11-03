import "server-only";

import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { firstGuestPlanOccurrence, guestPlanDateWindow } from "./guestPlanAvailability";

/**
 * Read-only verification of real, public event occurrences. Used both for
 * freshly generated suggestions and for validating pre-v2 saved guest drafts.
 * No quota, recommendation trace, or new ranking is generated here.
 */
export async function confirmedGuestPlanOccurrences(
  ids: readonly string[],
  date: string,
  dateTo?: string,
): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const range = guestPlanDateWindow(date, dateTo);
  const now = new Date();
  const rows = await prisma.activity.findMany({
    where: {
      id: { in: [...new Set(ids)].slice(0, 80) },
      type: ActivityType.EVENT,
      ...getPublicListingActivityWhere(now),
    },
    select: {
      id: true,
      nextOccurrenceAt: true,
      _count: { select: { sessions: true } },
      sessions: {
        where: { startsAt: { gte: range.start, lt: range.end } },
        select: { startsAt: true, withdrawnAt: true },
        orderBy: { startsAt: "asc" },
      },
    },
  });
  return new Map(rows.flatMap((row) => {
    const startsAt = firstGuestPlanOccurrence({
      sessions: row.sessions,
      hasStoredSessions: row._count.sessions > 0,
      nextOccurrenceAt: row.nextOccurrenceAt,
      rangeStart: range.start,
      rangeEnd: range.end,
      now,
    });
    return startsAt ? [[row.id, startsAt.toISOString()] as const] : [];
  }));
}
