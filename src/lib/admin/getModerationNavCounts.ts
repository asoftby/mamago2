import prisma from "@/lib/prisma";
import type { ModerationNavCounts } from "@/lib/admin/moderationSidebarConfig";

/**
 * Агрегирует счётчики для бейджа «Очередь» и детальную разбивку.
 * queueTotal = места (новые) + правки мест + события + предложения в статусе PENDING.
 */
export async function getModerationNavCounts(): Promise<ModerationNavCounts> {
  const [pendingPlaces, pendingRevisions, eventsPending, offersPending] =
    await Promise.all([
      prisma.place.count({ where: { status: "PENDING" } }),
      prisma.placeRevision.count({ where: { status: "PENDING" } }),
      prisma.activity.count({ where: { status: "PENDING" } }),
      prisma.offer.count({ where: { status: "PENDING" } }),
    ]);

  return {
    queueTotal: pendingPlaces + pendingRevisions + eventsPending + offersPending,
    places: pendingPlaces,
    events: eventsPending,
    offers: offersPending,
  };
}
