import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { addDaysLocal } from "@/lib/date/localDateKey";
import { deriveEventRequestBookingColumns } from "@/lib/event/eventRequestBookingColumns";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";
import { createPublicBooking } from "./booking.service";
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

    const page = (event: typeof calendar) => buildEventPageDataFromPrismaActivity({
      ...event, images: [], place: null, venue: null, eventCategory: null,
    });
    assert.equal(page(request).cta.simpleBooking?.label, "Оставить заявку");
    assert.equal(page(simple).cta.simpleBooking?.slots?.[0]?.id, simple.sessions[0]?.id);
    assert.deepEqual(page(calendar).cta.simpleBooking?.slots?.map(({ id }) => id), calendar.sessions.map(({ id }) => id));
    assert.equal(page({ ...calendar, bookingEnabled: false }).cta.simpleBooking, undefined);

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
    await assert.rejects(submit(calendar.id, 1), /выбрать слот/);
    await assert.rejects(submit(calendar.id, 1, "wizard-first"), /Слот недоступен/);
    await assert.rejects(submit(calendar.id, 1, simple.sessions[0]!.id), /Слот недоступен/);
    await assert.rejects(submit(calendar.id, 1, first.id, "15:00"), /не соответствуют слоту/);

    const raced = await Promise.allSettled([submit(calendar.id, 2, first.id), submit(calendar.id, 3, first.id)]);
    const successes = raced.flatMap((entry) => entry.status === "fulfilled" ? [entry.value] : []);
    assert.equal(successes.length, 1);
    const rejected = raced.find((entry) => entry.status === "rejected");
    assert.match(String(rejected?.reason), /недостаточно мест/);
    const winner = successes[0]!;

    const duplicateRace = await Promise.allSettled([submit(calendar.id, 4, second.id), submit(calendar.id, 4, second.id)]);
    assert.equal(duplicateRace.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.match(String(duplicateRace.find((entry) => entry.status === "rejected")?.reason), /уже существует/);

    const inbox = await getBusinessInbox({ businessId: business.id, kind: "standard" });
    for (const result of [requestBooking, simpleBooking, winner]) {
      assert.ok(inbox.items.some((item) => item.id === result.bookingId));
    }
    const calendarView = await getBusinessBookings({ businessId: business.id, date: new Date(date) });
    const row = calendarView.items.find((item) => item.id === winner.bookingId);
    assert.equal(row?.session?.id, first.id);
    assert.equal(row?.requestedDate, new Date(date).toISOString());
    assert.equal(row?.requestedTime, "13:00");
    assert.equal((await getBusinessBookings({ businessId: "foreign-business" })).items.length, 0);
    await assert.rejects(updateBookingStatus(winner.bookingId, "foreign-business", "CONFIRMED"));
    await updateBookingStatus(winner.bookingId, business.id, "CONFIRMED");
    await assert.rejects(submit(calendar.id, 5, first.id), /недостаточно мест/);
    await updateBookingStatus(winner.bookingId, business.id, "REJECTED");
    const replacement = await submit(calendar.id, 5, first.id);

    await replaceActivitySessionsFromScheduleJson({
      prisma, activityId: calendar.id,
      scheduleJson: { dates: [date], startTime: "13:00" },
    });
    assert.equal((await prisma.activitySession.findUniqueOrThrow({ where: { id: first.id } })).withdrawnAt, null);
    assert.ok((await prisma.activitySession.findUniqueOrThrow({ where: { id: second.id } })).withdrawnAt);
    assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: replacement.bookingId } })).selectedSessionId, first.id);
    await assert.rejects(submit(calendar.id, 6, second.id), /Слот недоступен/);
  } finally {
    await prisma.bookingRequest.deleteMany({ where: { businessId: business.id } });
    await prisma.activity.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.$disconnect();
  }
});
