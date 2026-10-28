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

/**
 * Turn abandoned outbound attempts into explicit reconciliation work.
 * A provider may have accepted a message before our process died, so
 * the transition is PENDING -> FAILED only; NEVER send automatically.
 *
 * The updatedAt guard avoids touching an attempt still being processed.
 * Runs only for notifications produced by the party outbox.
 */
export async function reconcileStalePartyDeliveries(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 10 * 60_000);
  const result = await prisma.notificationDelivery.updateMany({
    where: {
      notification: { is: { metadata: { path: ["source"], equals: "PARTY_OUTBOX" } } },
      channel: { in: ["EMAIL", "TELEGRAM"] },
      status: "PENDING",
      updatedAt: { lt: staleBefore },
    },
    data: { status: "FAILED", errorMessage: "STALE_PENDING_RECONCILED" },
  });
  return { markedForManualReconciliation: result.count };
}
