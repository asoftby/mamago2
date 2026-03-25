import prisma from "@/lib/prisma";
import type { ModerationNavCounts } from "@/lib/admin/moderationSidebarConfig";

/**
 * Агрегирует счётчики для бейджей секции «Модерация».
 * Логика очереди совпадает с `getQueueItems` на `/admin/moderation/queue`.
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
    queueTotal: pendingPlaces + pendingRevisions,
    places: pendingPlaces,
    events: eventsPending,
    offers: offersPending,
  };
}
