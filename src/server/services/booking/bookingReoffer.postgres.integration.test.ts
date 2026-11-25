import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { addDaysLocal } from "@/lib/date/localDateKey";
import { deriveEventRequestBookingColumns } from "@/lib/event/eventRequestBookingColumns";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { createPublicBooking } from "./booking.service";
import { updateBookingStatus } from "./bookingQuery.service";
import { getBusinessBookingDecisionAvailability } from "./bookingDecisionAvailability.service";

const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Reoffer PostgreSQL tests require disposable localhost database");
}

test("reoffer creates only one new booking after consent, preserving rejected request", async () => {
  const suffix = randomUUID();
  const owner = await prisma.user.create({ data: { email: `reoffer-owner-${suffix}@example.test` } });
  const customer = await prisma.user.create({ data: { email: `reoffer-customer-${suffix}@example.test` } });
  const business = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Reoffer test" } });
  const scheduleJson: Prisma.InputJsonObject = {
    participationMode: "time-slots",
    timeSlots: { dates: [{ isoDate: addDaysLocal(new Date(), 7), slots: [{ startTime: "13:00", capacity: 1 }] }] },
  };
  const columns = deriveEventRequestBookingColumns({
    participationMode: scheduleJson.participationMode,
    scheduleJson, current: { bookingEnabled: false, bookingMode: null }, hasBusiness: true,
  });
  const activity = await prisma.activity.create({
    data: {
      ownerUserId: owner.id, businessId: business.id, title: "Reoffer event",
      shortDesc: "Integration test", type: "EVENT", scheduleMode: "ONE_TIME",
      scheduleJson, ...columns, status: "DRAFT",
    },
  });

  try {
    await replaceActivitySessionsFromScheduleJson({ prisma, activityId: activity.id, scheduleJson });
    const session = await prisma.activitySession.findFirstOrThrow({
      where: { activityId: activity.id }, select: { id: true },
    });
    await prisma.activity.update({ where: { id: activity.id }, data: { status: "PUBLISHED" } });

    const initial = await createPublicBooking({
      publicationType: "EVENT", publicationId: activity.id, selectedSessionId: session.id,
      customerName: "Reoffer client", customerPhone: "+375291111199", userId: customer.id,
    });
    await updateBookingStatus(initial.bookingId, business.id, "REJECTED", {
      actorId: owner.id, actorRole: "BUSINESS", reason: "Больше нет свободных мест",
    });
    const available = await getBusinessBookingDecisionAvailability(
      prisma, initial.bookingId, business.id, new Date(), { reoffer: true },
    );
    assert.equal(available?.canConfirm, true);
    assert.equal(available?.code, "AVAILABLE");

    const original = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: initial.bookingId } });
    const invitation = await prisma.bookingReoffer.create({
      data: {
        originalBookingId: original.id, businessId: business.id,
        customerUserId: customer.id, activityId: activity.id, invitedById: owner.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const attempt = () => createPublicBooking({
      reofferId: invitation.id, publicationType: "EVENT", publicationId: activity.id,
      selectedSessionId: original.selectedSessionId, requestedDate: original.requestedDate,
      requestedTime: original.requestedTime, userId: customer.id,
      customerName: original.customerName!, customerPhone: original.customerPhone!,
      adultsCount: original.adultsCount, childrenCount: original.childrenCount,
    });
    const results = await Promise.allSettled([attempt(), attempt()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1,
      "row locking must permit only one accepted invitation");
    const after = await prisma.bookingReoffer.findUniqueOrThrow({ where: { id: invitation.id } });
    assert.equal(after.status, "ACCEPTED");
    assert.ok(after.newBookingId);
    assert.notEqual(after.newBookingId, initial.bookingId);
    assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: initial.bookingId } })).status, "REJECTED");
    assert.equal(await prisma.bookingRequest.count({
      where: { activityId: activity.id, status: { in: ["NEW", "CONFIRMED"] } },
    }), 1);
  } finally {
    await prisma.activity.delete({ where: { id: activity.id } }).catch(() => null);
    await prisma.business.delete({ where: { id: business.id } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, customer.id] } } }).catch(() => null);
  }
});
