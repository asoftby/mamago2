import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { BookingStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { expireStandardRequests } from "./standardRequestExpiry.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Standard request expiry tests require disposable localhost PostgreSQL");
}
const suffix = randomUUID().slice(0, 10);
const ownerId = "std-expiry-owner-" + suffix;
const clientId = "std-expiry-client-" + suffix;
let businessId = "";
after(async () => {
  if (businessId) {
    await prisma.bookingAllocation.deleteMany({ where: { bookingRequest: { businessId } } });
    await prisma.bookingRequest.deleteMany({ where: { businessId } });
    await prisma.bookingUnit.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
  }
  await prisma.notification.deleteMany({ where: { userId: clientId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, clientId] } } });
  await prisma.$disconnect();
});

const contact = { customerName: "Test", customerPhone: "+375291112233" };
const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 3_600_000);

async function fixture() {
  if (businessId) return;
  await prisma.user.createMany({ data: [
    { id: ownerId, email: ownerId + "@example.test" },
    { id: clientId, email: clientId + "@example.test" },
  ] });
  businessId = (await prisma.business.create({ data: {
    name: "Standard expiry test " + suffix, ownerUserId: ownerId,
  } })).id;
}
const create = (data: { status?: BookingStatus; responseDueAt?: Date | null; userId?: string }) =>
  prisma.bookingRequest.create({ data: {
    businessId, publicationType: PublicationType.OFFER, ...contact,
    adultsCount: 2, childrenCount: 1, status: BookingStatus.NEW, ...data,
  } });
const statusOf = async (id: string) =>
  (await prisma.bookingRequest.findUniqueOrThrow({ where: { id } })).status;

test("overdue NEW request expires once, releases holds, notifies the client once", async () => {
  await fixture();
  const due = await create({ responseDueAt: past(), userId: clientId });
  const confirmed = await create({ status: BookingStatus.CONFIRMED, responseDueAt: past() });
  const notYet = await create({ responseDueAt: future() });
  const noDeadline = await create({ responseDueAt: null });
  const unit = await prisma.bookingUnit.create({ data: { businessId, name: "Room " + suffix } });
  const allocation = await prisma.bookingAllocation.create({ data: {
    bookingUnitId: unit.id, bookingRequestId: due.id, status: "HELD",
    blockStart: new Date(Date.now() + 86_400_000), blockEnd: new Date(Date.now() + 90_000_000),
    expiresAt: new Date(Date.now() + 3_600_000),
  } });

  const first = await expireStandardRequests(100);
  assert.ok(first.expired >= 1);
  assert.equal(await statusOf(due.id), BookingStatus.EXPIRED);
  assert.equal(await statusOf(confirmed.id), BookingStatus.CONFIRMED, "confirmed request must not expire");
  assert.equal(await statusOf(notYet.id), BookingStatus.NEW);
  assert.equal(await statusOf(noDeadline.id), BookingStatus.NEW);
  assert.equal((await prisma.bookingAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).status, "RELEASED");
  // Seats are counted only for NEW/CONFIRMED, so the expired request no longer holds any.
  const occupied = await prisma.bookingRequest.aggregate({
    where: { businessId, status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] }, id: due.id },
    _sum: { adultsCount: true, childrenCount: true },
  });
  assert.equal(occupied._sum.adultsCount, null);
  assert.equal(await prisma.bookingActivity.count({ where: { bookingId: due.id, type: "REQUEST_EXPIRED" } }), 1);
  assert.equal(await prisma.notification.count({ where: { userId: clientId, entityId: due.id } }), 1);
  const notification = await prisma.notification.findFirstOrThrow({ where: { userId: clientId, entityId: due.id } });
  assert.match(notification.body ?? "", /другое время/);

  // Repeat run changes nothing: no new activity, no second notification.
  const second = await expireStandardRequests(100);
  assert.equal(second.expired, 0);
  assert.equal(await prisma.bookingActivity.count({ where: { bookingId: due.id, type: "REQUEST_EXPIRED" } }), 1);
  assert.equal(await prisma.notification.count({ where: { userId: clientId, entityId: due.id } }), 1);
});

test("a request confirmed concurrently is not overwritten by expiry", async () => {
  await fixture();
  const booking = await create({ responseDueAt: past() });
  await prisma.bookingRequest.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED } });
  const result = await expireStandardRequests(100);
  assert.equal(result.expired, 0);
  assert.equal(await statusOf(booking.id), BookingStatus.CONFIRMED);
});

test("a failed notification is retried on the next run without duplicates", async () => {
  await fixture();
  const booking = await create({ responseDueAt: past(), userId: clientId });
  const failing = await expireStandardRequests(100, new Date(), {
    notify: async () => { throw new Error("delivery down"); },
  });
  assert.equal(failing.notified, 0);
  assert.equal(await statusOf(booking.id), BookingStatus.EXPIRED, "status change is committed");
  assert.equal(await prisma.notification.count({ where: { userId: clientId, entityId: booking.id } }), 0);

  const retry = await expireStandardRequests(100);
  assert.equal(retry.expired, 0);
  assert.equal(await prisma.notification.count({ where: { userId: clientId, entityId: booking.id } }), 1);

  await expireStandardRequests(100);
  assert.equal(await prisma.notification.count({ where: { userId: clientId, entityId: booking.id } }), 1);
});
