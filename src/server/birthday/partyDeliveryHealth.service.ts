import "server-only";

import prisma from "@/lib/prisma";

/**
 * Aggregated, privacy-safe operational signal. An outbox row marked SENT only
 * means dispatch was attempted: downstream channel deliveries can still fail.
 * Never automatically retry an ambiguous Telegram PENDING message.
 */
export async function getPartyDeliveryHealth(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 10 * 60_000);
  const notificationWhere = {
    notification: {
      is: {
        metadata: { path: ["source"], equals: "PARTY_OUTBOX" },
      },
    },
  } as const;
  const [exhaustedOutbox, failedChannels, stalePendingChannels] = await Promise.all([
    prisma.partyOutbox.count({
      where: { status: "FAILED", attempts: { gte: 5 } },
    }),
    prisma.notificationDelivery.count({
      where: { ...notificationWhere, channel: { in: ["EMAIL", "TELEGRAM"] }, status: "FAILED" },
    }),
    prisma.notificationDelivery.count({
      where: {
        ...notificationWhere, channel: { in: ["EMAIL", "TELEGRAM"] },
        status: "PENDING", createdAt: { lt: staleBefore },
      },
    }),
  ]);
  return {
    exhaustedOutbox,
    failedChannels,
    stalePendingChannels,
    requiresAttention: exhaustedOutbox > 0 || failedChannels > 0 || stalePendingChannels > 0,
  };
}
