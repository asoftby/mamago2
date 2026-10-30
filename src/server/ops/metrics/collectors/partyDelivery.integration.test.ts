/**
 * Real PostgreSQL regression for P0 #865. Requires an isolated DB with migrations.
 * Only synthetic user/business/booking/notification rows are created; all cleaned up.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { collectPartyDeliveryMetrics } from "./partyDelivery";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be an isolated migrated PostgreSQL database");
const dbHost = new URL(process.env.DATABASE_URL).hostname;
if (!["localhost", "127.0.0.1"].includes(dbHost)) {
  throw new Error("Party delivery PostgreSQL test refuses non-local databases");
}
const prisma = new PrismaClient();
const marker = randomUUID();
const ids: { delivery: string[]; notifications: string[]; outbox: string[]; booking?: string; business?: string; user?: string } = {
  delivery: [], notifications: [], outbox: [],
};
function value(samples: Awaited<ReturnType<typeof collectPartyDeliveryMetrics>>, metric: string): number {
  const match = samples.find(sample => sample.metric === metric);
  if (!match) throw new Error("Metric missing: " + metric);
  return match.value;
}
async function main() {
  try {
    const now = new Date();
    const before = await collectPartyDeliveryMetrics({ prisma, now });
    const user = await prisma.user.create({ data: { email: `party-delivery-metric-${marker}@example.invalid` } });
    ids.user = user.id;
    const business = await prisma.business.create({ data: { ownerUserId: user.id, name: "Synthetic metric test" } });
    ids.business = business.id;
    const booking = await prisma.bookingRequest.create({
      data: { businessId: business.id, publicationType: "OFFER", kind: "PARTY" },
    });
    ids.booking = booking.id;
    const event = await prisma.partyOutbox.create({
      data: { eventType: "PARTY_REQUEST_SENT", aggregateId: booking.id,
        dedupeKey: `metric-${marker}`, payload: {}, status: "FAILED", attempts: 5 },
    });
    ids.outbox.push(event.id);
    const old = new Date(now.getTime() - 20 * 60_000);
    for (const [status, updatedAt] of [
      ["FAILED", now],
      ["PENDING", old],
      ["PENDING", now],
      ["SENT", now],
    ] as const) {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id, title: "Synthetic", body: "Synthetic", type: "BOOKING_REQUEST",
          entityType: "BOOKING", entityId: booking.id,
        },
      });
      ids.notifications.push(notification.id);
      const delivery = await prisma.notificationDelivery.create({
        data: { notificationId: notification.id, userId: user.id, channel: "TELEGRAM",
          status, updatedAt },
      });
      ids.delivery.push(delivery.id);
    }
    const after = await collectPartyDeliveryMetrics({ prisma, now });
    assert.equal(value(after, "party.outbox_failed_exhausted") - value(before, "party.outbox_failed_exhausted"), 1);
    assert.equal(value(after, "party.telegram_delivery_failed") - value(before, "party.telegram_delivery_failed"), 1);
    assert.equal(value(after, "party.telegram_pending_stale") - value(before, "party.telegram_pending_stale"), 1);
    console.log("partyDelivery.integration.test.ts: OK");
  } finally {
    await prisma.notificationDelivery.deleteMany({ where: { id: { in: ids.delivery } } });
    await prisma.notification.deleteMany({ where: { id: { in: ids.notifications } } });
    await prisma.partyOutbox.deleteMany({ where: { id: { in: ids.outbox } } });
    if (ids.booking) await prisma.bookingRequest.delete({ where: { id: ids.booking } });
    if (ids.business) await prisma.business.delete({ where: { id: ids.business } });
    if (ids.user) await prisma.user.delete({ where: { id: ids.user } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
