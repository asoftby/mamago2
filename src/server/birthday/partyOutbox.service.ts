import "server-only";

import { PartyOutboxStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { dispatchDelivery } from "@/server/services/notificationDelivery.service";
import {
  heldPartyOutboxEventTypes, isPartyOutboxEventType, partyNotificationId, partyOutboxBackoff, partyOutboxCopy,
} from "./partyOutbox.logic";

const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60_000;

type PartyOutboxRow = {
  id: string; eventType: string; aggregateId: string;
  attempts: number; nextAttemptAt: Date; status: PartyOutboxStatus;
};

async function processOne(row: PartyOutboxRow): Promise<"sent" | "skipped" | "failed"> {
  const now = new Date();
  const claimed = await prisma.partyOutbox.updateMany({
    where: {
      id: row.id,
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: "FAILED",
      attempts: { increment: 1 },
      nextAttemptAt: new Date(now.getTime() + LEASE_MS),
    },
  });
  if (claimed.count !== 1) return "skipped";

  try {
    if (!isPartyOutboxEventType(row.eventType)) {
      // Unknown events are quarantined, not discarded or retried endlessly.
      throw new Error("Unsupported party outbox event");
    }
    const request = await prisma.bookingRequest.findFirst({
      where: { id: row.aggregateId, kind: "PARTY" },
      select: {
        id: true, businessId: true, offer: { select: { title: true } },
        partyOrderItem: {
          select: { partyOrder: { select: { ownerUserId: true, eventDate: true } } },
        },
      },
    });
    if (!request || !request.partyOrderItem) {
      // Deleted order: no valid recipient remains.
      await prisma.partyOutbox.update({
        where: { id: row.id }, data: { status: "SENT" },
      });
      return "skipped";
    }

    const order = request.partyOrderItem.partyOrder;
    const recipients = (row.eventType === "PARTY_REQUEST_SENT" || row.eventType === "PARTY_QUOTE_ACCEPTED")
      ? (await prisma.businessMember.findMany({
          where: { businessId: request.businessId, isActive: true,
            role: { in: ["OWNER", "MANAGER"] } },
          select: { userId: true },
        })).map((member) => member.userId)
      : [order.ownerUserId];

    const uniqueIds = [...new Set(recipients)];
    if (uniqueIds.length === 0) throw new Error("No active business recipients");

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, role: true, email: true },
    });
    if (users.length === 0) throw new Error("Recipients not found");

    const copy = partyOutboxCopy({
      type: row.eventType,
      offerTitle: request.offer?.title ?? "Праздничная услуга",
      dateLabel: order.eventDate?.toISOString().slice(0, 10) ?? "указанную дату",
    });

    // Deterministic IDs make in-app notifications idempotent even after a
    // worker crash. External channel attempts are tracked in NotificationDelivery.
    const ids = users.map((user) => partyNotificationId(row.id, user.id));
    await prisma.notification.createMany({
      data: users.map((user) => ({
        id: partyNotificationId(row.id, user.id),
        userId: user.id,
        type: copy.type,
        audience: copy.audience,
        title: copy.title,
        body: copy.body,
        entityType: "BOOKING",
        entityId: request.id,
        actionMode: "PAGE",
        actionUrl: copy.actionUrl,
        ctaLabel: "Открыть",
        ctaAction: copy.actionUrl,
        metadata: {
          source: "PARTY_OUTBOX", outboxId: row.id,
          templatePayload: {
            bookingSummary: copy.body,
            actor: "Семья",
            customerName: "Семья",
            offerTitle: request.offer?.title ?? "Праздничная услуга",
          },
        },
      })),
      skipDuplicates: true,
    });
    const notifications = await prisma.notification.findMany({
      where: { id: { in: ids } },
    });

    for (const notification of notifications) {
      const user = users.find((u) => u.id === notification.userId);
      if (!user) continue;
      const prior = await prisma.notificationDelivery.count({
        where: { notificationId: notification.id },
      });
      if (prior > 0) {
        // A crash between Telegram's sendMessage and SENT marking cannot be
        // retried automatically without risking duplicate messages. Existing
        // delivery records (including ambiguous PENDING) require reconciliation.
        continue;
      }
      await dispatchDelivery(notification, user);
    }

    await prisma.partyOutbox.update({
      where: { id: row.id },
      data: { status: "SENT" },
    });
    return "sent";
  } catch {
    // Never log the raw event payload or contact details.
    console.error("[party-outbox] delivery failed", { eventId: row.id,
      attempt: row.attempts + 1, code: "DELIVERY_FAILED" });
    const attempt = row.attempts + 1;
    await prisma.partyOutbox.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        nextAttemptAt: new Date(Date.now() + partyOutboxBackoff(attempt)),
      },
    });
    return "failed";
  }
}

/** Invoked only by the authorized cron route. No delivery occurs in user requests. */
export async function dispatchPartyOutbox(batchSize = 20) {
  const due = await prisma.partyOutbox.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
      // Held until the business inbox UI exists; the event is kept, not discarded.
      eventType: { notIn: heldPartyOutboxEventTypes(process.env) },
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(50, Math.max(1, batchSize)),
    select: {
      id: true, eventType: true, aggregateId: true,
      attempts: true, nextAttemptAt: true, status: true,
    },
  });
  const counts = { sent: 0, skipped: 0, failed: 0 };
  for (const row of due) {
    const outcome = await processOne(row);
    counts[outcome]++;
  }
  return { processed: due.length, ...counts };
}
