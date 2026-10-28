import "server-only";

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Privacy-safe monitoring only. Outbox SENT does not imply Telegram SENT.
 * Ambiguous PENDING deliveries must be reconciled, not automatically resent.
 */
export async function getPartyDeliveryHealth(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 10 * 60_000);
  const partyNotifications: Prisma.NotificationDeliveryWhereInput = {
    notification: { is: { metadata: { path: ["source"], equals: "PARTY_OUTBOX" } } },
    channel: { in: ["EMAIL", "TELEGRAM"] },
  };
  const [exhaustedOutbox, failedChannels, stalePendingChannels] = await Promise.all([
    prisma.partyOutbox.count({ where: { status: "FAILED", attempts: { gte: 5 } } }),
    prisma.notificationDelivery.count({
      where: { AND: [partyNotifications, { status: "FAILED" }] },
    }),
    prisma.notificationDelivery.count({
      where: { AND: [partyNotifications, { status: "PENDING", createdAt: { lt: staleBefore } }] },
    }),
  ]);
  return {
    exhaustedOutbox,
    failedChannels,
    stalePendingChannels,
    requiresAttention: exhaustedOutbox > 0 || failedChannels > 0 || stalePendingChannels > 0,
  };
}
