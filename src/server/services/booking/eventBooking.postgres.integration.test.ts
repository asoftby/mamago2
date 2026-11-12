import { activePlanScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import { getPlanBookingStates } from "@/server/family/planBooking.service";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import { deriveEventRequestBookingColumns } from "@/lib/event/eventRequestBookingColumns";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";
import { createManualBooking, createPublicBooking } from "./booking.service";
import { getBusinessBookings, updateBookingStatus } from "./bookingQuery.service";
import { getBusinessInbox } from "./businessInbox.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Event booking tests require disposable localhost PostgreSQL");
}

test("event booking uses persisted sessions, serializes requests and appears in both business views", async () => {
  const suffix = randomUUID();
  const owner = await prisma.user.create({ data: { email: `event-${suffix}@example.test` } });
  const business = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Event booking test" } });
  const date = addDaysLocal(new Date(), 7);
  const makeEvent = async (scheduleJson: Prisma.InputJsonObject) => {
    const columns = deriveEventRequestBookingColumns({
      participationMode: scheduleJson.participationMode,
      scheduleJson,
      current: { bookingEnabled: false, bookingMode: null },
      hasBusiness: true,
    });
    const activity = await prisma.activity.create({
      data: {
        ownerUserId: owner.id, businessId: business.id, status: "DRAFT",
        title: "Event booking test", shortDesc: "Test", type: "EVENT",
        scheduleMode: "ONE_TIME", scheduleJson, ...columns,
      },
    });
    await replaceActivitySessionsFromScheduleJson({ prisma, activityId: activity.id, scheduleJson });
    assert.equal(await prisma.bookingRequest.count({ where: { activityId: activity.id } }), 0);
    await assert.rejects(createPublicBooking({
      publicationType: "EVENT", publicationId: activity.id, customerName: "Test", customerPhone: "+375291110000",
    }), /недоступно/);
    return prisma.activity.update({
      where: { id: activity.id },
      data: { status: "PUBLISHED" },
      include: { sessions: { orderBy: { startsAt: "asc" } } },
    });
  };

  try {

    // A successful authenticated booking must atomically appear in the plan
    // with the persisted ActivitySession time, not only in BookingRequest.
    const planEvent = await makeEvent({
      participationMode: "time-slots",
      timeSlots: { dates: [{ isoDate: date, slots: [{ startTime: "09:00", capacity: 5 }] }] },
    });
    const savedOccurrence = await prisma.planItem.create({
      data: {
        userId: owner.id,
        activityId: planEvent.id,
        date,
        title: planEvent.title,
        startsAt: new Date(planEvent.sessions[0]!.startsAt.getTime() - 3_600_000),
      },
    });
    const planBooking = await createPublicBooking({
      publicationType: "EVENT",
      publicationId: planEvent.id,
      selectedSessionId: planEvent.sessions[0]!.id,
      customerName: "Parent",
      customerPhone: "+375291119999",
      userId: owner.id,
    });
    const persistedPlanBooking = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id: planBooking.bookingId },
    });
    assert.equal(persistedPlanBooking.userId, owner.id);
    assert.ok(persistedPlanBooking.planItemId);
    const planItem = await prisma.planItem.findUniqueOrThrow({
      where: { id: persistedPlanBooking.planItemId! },
    });
    assert.equal(planItem.id, savedOccurrence.id, "reuse the saved occurrence instead of duplicating it");
    assert.equal(planItem.activityId, planEvent.id);
    assert.equal(planItem.userId, owner.id);
    assert.equal(planItem.date, date);
    assert.equal(planItem.startsAt?.toISOString(), planEvent.sessions[0]!.startsAt.toISOString());
    await assert.rejects(createPublicBooking({
      publicationType: "EVENT",
      publicationId: planEvent.id,
      selectedSessionId: planEvent.sessions[0]!.id,
      customerName: "Parent",
      customerPhone: "+375291119999",
      userId: owner.id,
    }), /уже существует/);
    assert.equal(await prisma.planItem.count({ where: { userId: owner.id, activityId: planEvent.id } }), 1);
    const nativePrebook = await makeEvent({
      participationMode: "prebook", prebookMethod: "internal",
    });
    const legacyPrebook = await makeEvent({
      participationMode: "prebook", prebookMethod: "phone", prebookPhone: "+375291112233",
    });
    const internalBooking = await createPublicBooking({
      publicationType: "EVENT", publicationId: nativePrebook.id,
      customerName: "Prebooking visitor", customerPhone: "+375291110056",
    });
    const internalRow = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id: internalBooking.bookingId },
    });
    assert.equal(nativePrebook.bookingMode, "REQUEST_ONLY");
    assert.equal(internalRow.status, "NEW");
    assert.equal(internalRow.publicationType, "EVENT");
    assert.equal(internalRow.activityId, nativePrebook.id);
    assert.equal(internalRow.businessId, business.id);
    assert.equal(legacyPrebook.bookingEnabled, false);
    await assert.rejects(createPublicBooking({
      publicationType: "EVENT", publicationId: legacyPrebook.id,
      customerName: "External visitor", customerPhone: "+375291110057",
    }), /недоступна|недоступно/);


    // Authorship is not family access: reuse only active occurrences visible
    // in the booker's current family, never retained former-family history.
    const familyFlagBefore = process.env.FAMILY_CORE_READS;
    const aclUserIds: string[] = [];
    const aclFamilyIds: string[] = [];
    const aclActivityIds: string[] = [];
    try {
      process.env.FAMILY_CORE_READS = "1";
      const currentFamilyId = await familyIdForWrite(owner.id);
      aclFamilyIds.push(currentFamilyId);
      const adult = await prisma.user.create({ data: { email: `event-current-adult-${suffix}@example.test` } });
      aclUserIds.push(adult.id);
      const formerViewer = await prisma.user.create({ data: { email: `event-former-adult-${suffix}@example.test` } });
      aclUserIds.push(formerViewer.id);
      const oldFamily = await prisma.family.create({ data: { name: "Former event family " + suffix } });
      aclFamilyIds.push(oldFamily.id);
      await prisma.familyMembership.createMany({ data: [
        { userId: adult.id, familyId: currentFamilyId, role: "ADULT", historyAccess: "ALL" },
        { userId: formerViewer.id, familyId: oldFamily.id, role: "OWNER", historyAccess: "ALL" },
        { userId: owner.id, familyId: oldFamily.id, role: "ADULT",
          joinedAt: new Date(Date.now() - 2 * 86_400_000), leftAt: new Date(Date.now() - 86_400_000) },
      ] });
      const aclEvent = async (time: string) => {
        const event = await makeEvent({
          participationMode: "time-slots",
          timeSlots: { dates: [{ isoDate: date, slots: [{ startTime: time, capacity: 5 }] }] },
        });
        aclActivityIds.push(event.id);
        return event;
      };
      const book = async (event: Awaited<ReturnType<typeof aclEvent>>, phone: string) => {
        const booking = await createPublicBooking({
          publicationType: "EVENT", publicationId: event.id,
          selectedSessionId: event.sessions[0]!.id,
          customerName: "Current family parent", customerPhone: phone, userId: owner.id,
        });
        return prisma.bookingRequest.findUniqueOrThrow({ where: { id: booking.bookingId } });
      };
      const sharedEvent = await aclEvent("10:00");
      const shared = await prisma.planItem.create({ data: {
        userId: adult.id, familyId: currentFamilyId, visibility: "FAMILY",
        activityId: sharedEvent.id, date, startsAt: null,
      } });
      const privateItem = await prisma.planItem.create({ data: {
        userId: adult.id, familyId: currentFamilyId, visibility: "PRIVATE",
        activityId: sharedEvent.id, date, startsAt: sharedEvent.sessions[0]!.startsAt,
      } });
      const sharedBooking = await book(sharedEvent, "+375291110071");
      assert.equal(sharedBooking.planItemId, shared.id, "reuse another current adult's shared occurrence");
      assert.notEqual(sharedBooking.planItemId, privateItem.id, "never reuse another adult's private occurrence");
      assert.equal((await prisma.planItem.findUniqueOrThrow({ where: { id: shared.id } })).startsAt?.getTime(),
        sharedEvent.sessions[0]!.startsAt.getTime());
      assert.equal((await getPlanBookingStates(adult.id, [shared.id])).get(shared.id)?.status, "NEW");

      const formerEvent = await aclEvent("11:00");
      const former = await prisma.planItem.create({ data: {
        userId: owner.id, familyId: oldFamily.id, visibility: "FAMILY",
        activityId: formerEvent.id, date, startsAt: null,
      } });
      const formerBooking = await book(formerEvent, "+375291110072");
      assert.ok(formerBooking.planItemId);
      assert.notEqual(formerBooking.planItemId, former.id, "authored former-family item is not accessible");
      const current = await prisma.planItem.findUniqueOrThrow({ where: { id: formerBooking.planItemId! } });
      assert.equal(current.familyId, currentFamilyId);
      assert.equal((await prisma.planItem.findUniqueOrThrow({ where: { id: former.id } })).startsAt, null);
      assert.equal((await getPlanBookingStates(formerViewer.id, [former.id])).size, 0,
        "new booking status/time must not leak to former family");
      assert.equal((await getPlanBookingStates(owner.id, [current.id])).get(current.id)?.status, "NEW");

      const cancelledEvent = await aclEvent("12:00");
      const cancelled = await prisma.planItem.create({ data: {
        userId: owner.id, familyId: currentFamilyId, visibility: "FAMILY",
        activityId: cancelledEvent.id, date, status: "CANCELLED", cancelledAt: null,
      } });
      const activeBooking = await book(cancelledEvent, "+375291110073");
      assert.ok(activeBooking.planItemId);
      assert.notEqual(activeBooking.planItemId, cancelled.id, "CANCELLED status is authoritative even without cancelledAt");
      assert.equal((await prisma.planItem.findUniqueOrThrow({ where: { id: cancelled.id } })).status, "CANCELLED");
      assert.ok(await prisma.planItem.findFirst({ where: {
        id: activeBooking.planItemId!, ...(await activePlanScopeFor(owner.id)),
      } }), "new occurrence must appear in the current active plan");
    } finally {
      if (aclActivityIds.length) await prisma.bookingRequest.deleteMany({ where: { activityId: { in: aclActivityIds } } });
      if (aclFamilyIds.length) {
        await prisma.planItem.deleteMany({ where: { familyId: { in: aclFamilyIds } } });
        await prisma.familyMembership.deleteMany({ where: { familyId: { in: aclFamilyIds } } });
        await prisma.family.deleteMany({ where: { id: { in: aclFamilyIds } } });
      }
      if (aclUserIds.length) await prisma.user.deleteMany({ where: { id: { in: aclUserIds } } });
      if (familyFlagBefore === undefined) delete process.env.FAMILY_CORE_READS;
      else process.env.FAMILY_CORE_READS = familyFlagBefore;
    }

    const request = await makeEvent({ participationMode: "request", dates: [date] });
    const simple = await makeEvent({
      participationMode: "simple-booking", simpleBookingDate: date, simpleBookingTime: "12:00–13:00",
    });
    const calendar = await makeEvent({
      participationMode: "time-slots", timeSlots: { dates: [{
        isoDate: date,
        slots: [
          { id: "wizard-first", startTime: "13:00", capacity: 1 },
          { id: "wizard-second", startTime: "15:00", capacity: 2 },
        ],
      }] },
    });

    const today = getLocalDateKey();
    const dateOnly = await makeEvent({
      participationMode: "time-slots", dates: [today], startTime: "00:01",
      timeSlots: { dates: [{ isoDate: today, slots: [{ startTime: "", capacity: 1 }] }] },
    });
    assert.equal(dateOnly.bookingMode, "USE_PUBLICATION_DATES");
    assert.equal(dateOnly.sessions.length, 1);

    const page = (event: typeof calendar) => buildEventPageDataFromPrismaActivity({
      ...event, images: [], place: null, venue: null, eventCategory: null,
    });
    assert.equal(page(request).cta.simpleBooking?.label, "Оставить заявку");
    assert.equal(page(nativePrebook).cta.simpleBooking?.label, "Предварительная запись");
    assert.equal(page(legacyPrebook).cta.simpleBooking, undefined);
    assert.equal(page(simple).cta.simpleBooking?.slots?.[0]?.id, simple.sessions[0]?.id);
    assert.deepEqual(page(calendar).cta.simpleBooking?.slots?.map(({ id }) => id), calendar.sessions.map(({ id }) => id));
    assert.equal(page({ ...calendar, bookingEnabled: false }).cta.simpleBooking, undefined);

    assert.deepEqual(page(dateOnly).cta.simpleBooking?.slots, [{ id: today, isoDate: today, startTime: "" }]);
    const dateInput = {
      publicationType: "EVENT" as const, publicationId: dateOnly.id, requestedDate: today,
      customerName: "Test Parent", customerPhone: "+375291110000",
    };
    await assert.rejects(createPublicBooking({ ...dateInput, requestedDate: date }), /Дата недоступна/);
    await assert.rejects(createPublicBooking({ ...dateInput, requestedTime: "00:01" }), /Дата недоступна/);
    const dayBooking = await createPublicBooking(dateInput);
    await assert.rejects(createPublicBooking({ ...dateInput, customerPhone: "+375291110099" }), /недостаточно мест/);
    const dayRow = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: dayBooking.bookingId } });
    assert.equal(dayRow.requestedTime, null);
    assert.equal(dayRow.selectedSessionId, null);

    const submit = (publicationId: string, phoneSuffix: number, selectedSessionId?: string, requestedTime?: string) =>
      createPublicBooking({
        publicationType: "EVENT", publicationId, selectedSessionId, requestedTime,
        customerName: "Test Parent", customerPhone: `+37529111000${phoneSuffix}`,
      });
    const first = calendar.sessions[0]!;
    const second = calendar.sessions[1]!;
    const [requestBooking, simpleBooking] = await Promise.all([
      submit(request.id, 1),
      submit(simple.id, 1, simple.sessions[0]!.id),
    ]);
    const businessNotice = await prisma.notification.findMany({
      where: { userId: owner.id, type: "BOOKING_CREATED", entityType: "BOOKING", entityId: requestBooking.bookingId },
    });
    assert.equal(businessNotice.length, 1, "business notification must exist before booking returns");
    const client = await prisma.user.create({ data: { email: `event-customer-${suffix}@example.test` } });
    try {
      const submitted = await createPublicBooking({
        publicationType: "EVENT",
        publicationId: request.id,
        customerName: "Test Customer",
        customerPhone: "+375291110099",
        userId: client.id,
      });
      const userNotice = await prisma.notification.findMany({
        where: { userId: client.id, type: "BOOKING_SUBMITTED", entityType: "BOOKING", entityId: submitted.bookingId },
      });
      assert.equal(userNotice.length, 1, "user must receive a submission acknowledgement");
      assert.equal(userNotice[0]?.audience, "USER");
      assert.equal(userNotice[0]?.ctaAction, "/me/bookings");
    } finally {
      await prisma.bookingRequest.deleteMany({ where: { userId: client.id } });
      await prisma.notification.deleteMany({ where: { userId: client.id } });
      await prisma.user.delete({ where: { id: client.id } });
    }
    await assert.rejects(submit(calendar.id, 1), /выбрать слот/);
    await assert.rejects(submit(calendar.id, 1, "wizard-first"), /Слот недоступен/);
    await assert.rejects(submit(calendar.id, 1, simple.sessions[0]!.id), /Слот недоступен/);
    await assert.rejects(submit(calendar.id, 1, first.id, "15:00"), /не соответствуют слоту/);

    const alias = await prisma.activitySession.create({
      data: { activityId: calendar.id, startsAt: first.startsAt },
    });
    const raced = await Promise.allSettled([submit(calendar.id, 2, first.id), submit(calendar.id, 3, alias.id)]);
    const successes = raced.flatMap((entry) => entry.status === "fulfilled" ? [entry.value] : []);
    assert.equal(successes.length, 1);
    const rejected = raced.find((entry) => entry.status === "rejected");
    assert.match(String(rejected?.reason), /недостаточно мест/);
    const winner = successes[0]!;

    const duplicateRace = await Promise.allSettled([submit(calendar.id, 4, second.id), submit(calendar.id, 4, second.id)]);
    assert.equal(duplicateRace.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.match(String(duplicateRace.find((entry) => entry.status === "rejected")?.reason), /уже существует/);

    const inbox = await getBusinessInbox({ businessId: business.id, kind: "standard" });
    for (const result of [requestBooking, simpleBooking, winner, internalBooking]) {
      assert.ok(inbox.items.some((item) => item.id === result.bookingId));
    }
    const calendarView = await getBusinessBookings({ businessId: business.id, date: new Date(date) });
    const row = calendarView.items.find((item) => item.id === winner.bookingId);
    assert.ok(row?.session && [first.id, alias.id].includes(row.session.id));
    assert.equal(row?.requestedDate, new Date(date).toISOString());
    assert.equal(row?.requestedTime, "13:00");
    assert.equal((await getBusinessBookings({ businessId: "foreign-business" })).items.length, 0);
    await assert.rejects(updateBookingStatus(winner.bookingId, "foreign-business", "CONFIRMED"));
    await updateBookingStatus(winner.bookingId, business.id, "CONFIRMED");
    await assert.rejects(submit(calendar.id, 5, first.id), /недостаточно мест/);
    await updateBookingStatus(winner.bookingId, business.id, "REJECTED");
    const replacement = await submit(calendar.id, 5, first.id);

    // Retain the original first occurrence if a duplicate imported row exists.
    await prisma.bookingRequest.updateMany({ where: { selectedSessionId: alias.id }, data: { selectedSessionId: first.id } });
    await prisma.activitySession.delete({ where: { id: alias.id } });
    await replaceActivitySessionsFromScheduleJson({
      prisma, activityId: calendar.id,
      scheduleJson: { dates: [date], startTime: "13:00" },
    });
    assert.equal((await prisma.activitySession.findUniqueOrThrow({ where: { id: first.id } })).withdrawnAt, null);
    assert.ok((await prisma.activitySession.findUniqueOrThrow({ where: { id: second.id } })).withdrawnAt);
    assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: replacement.bookingId } })).selectedSessionId, first.id);
    await assert.rejects(submit(calendar.id, 6, second.id), /Слот недоступен/);

    const context = { businessId: business.id, actorId: owner.id, requestKey: randomUUID() };
    const manualInput = {
      publicationType: "EVENT" as const, publicationId: request.id, status: "CONFIRMED" as const,
      customerName: "Manual Parent", customerPhone: "+375291110091",
    };
    await assert.rejects(createManualBooking(manualInput, { ...context, businessId: "foreign-business" }), /недоступно/);
    const [manual, replay] = await Promise.all([createManualBooking(manualInput, context), createManualBooking(manualInput, context)]);
    assert.deepEqual(manual, replay);
    assert.equal(manual.status, "CONFIRMED");
    const manualRow = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id: manual.bookingId }, include: { activities: true },
    });
    assert.equal(manualRow.source, "MANUAL");
    assert.equal(manualRow.userId, null);
    assert.equal(manualRow.requestedDate, null);
    assert.deepEqual(manualRow.activities.map(({ type, actorType, actorId }) => ({ type, actorType, actorId })),
      [{ type: "CREATED", actorType: "BUSINESS", actorId: owner.id }]);
    await assert.rejects(createManualBooking({ ...manualInput, customerName: "Different" }, context), /Ключ уже использован/);

    const book = (input: Partial<Parameters<typeof createManualBooking>[0]>) =>
      createManualBooking({ ...manualInput, ...input }, { ...context, requestKey: randomUUID() });
    await assert.rejects(book({ publicationId: calendar.id, selectedSessionId: second.id }), /Слот недоступен/);
    await assert.rejects(book({ publicationId: calendar.id, selectedSessionId: first.id }), /недостаточно мест/);
    await updateBookingStatus(replacement.bookingId, business.id, "REJECTED");
    const competing = await Promise.allSettled([
      book({ publicationId: calendar.id, selectedSessionId: first.id }),
      submit(calendar.id, 7, first.id),
    ]);
    assert.equal(competing.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.match(String(competing.find((entry) => entry.status === "rejected")?.reason), /недостаточно мест/);
    const accepted = competing.find((entry) => entry.status === "fulfilled")!;
    await updateBookingStatus(accepted.value.bookingId, business.id, "REJECTED");
    const manualSlot = await book({ publicationId: calendar.id, selectedSessionId: first.id });
    assert.ok((await getBusinessInbox({ businessId: business.id, bucket: "UPCOMING", kind: "standard" }))
      .items.some((item) => item.id === manualSlot.bookingId && item.source === "MANUAL"));
    assert.ok((await getBusinessBookings({ businessId: business.id, date: new Date(date) }))
      .items.some((item) => item.id === manualSlot.bookingId && item.source === "MANUAL"));
    await assert.rejects(book({ publicationId: dateOnly.id, requestedDate: today }), /недостаточно мест/);
    await updateBookingStatus(dayBooking.bookingId, business.id, "REJECTED");
    const manualDate = await book({ publicationId: dateOnly.id, requestedDate: today });
    const manualDateRow = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: manualDate.bookingId } });
    assert.equal(manualDateRow.requestedDate?.toISOString(), new Date(today).toISOString());
    assert.equal(manualDateRow.requestedTime, null);

  } finally {
    await prisma.bookingRequest.deleteMany({ where: { businessId: business.id } });
    await prisma.planItem.deleteMany({ where: { userId: owner.id } });
    await prisma.activity.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.$disconnect();
  }
});
