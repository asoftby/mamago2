import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  OfferExternalUrlRequiresModerationError,
  OfferScheduleValidationError,
  applyOfferSchedule,
} from "./offerSchedule.service";
import { buildClassScheduleInput, defaultClassSchedule, groupsFromRules } from "@/lib/offers/offerClassSchedule";
import { hoursFromSimple } from "@/lib/offers/offerSchedule";
import { BookingValidationError, createPublicBooking } from "@/server/services/booking/booking.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("offerSchedule integration tests require a disposable localhost PostgreSQL DATABASE_URL");
}
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const ownerId = `sched-owner-${run}`;
let businessId = "";
let placeId = "";
const offerIds: string[] = [];

after(async () => {
  if (offerIds.length) {
    await db.bookingRequest.deleteMany({ where: { offerId: { in: offerIds } } });
    await db.offer.deleteMany({ where: { id: { in: offerIds } } });
  }
  if (placeId) await db.place.delete({ where: { id: placeId } });
  if (businessId) await db.business.delete({ where: { id: businessId } });
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});

async function newOffer(extra: Record<string, unknown> = {}) {
  if (!businessId) {
    await db.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } });
    businessId = (await db.business.create({ data: { name: `sched-${run}`, ownerUserId: ownerId } })).id;
    placeId = (
      await db.place.create({
        data: {
          title: `Sched place ${run}`,
          shortDesc: "Test place",
          createdByUserId: ownerId,
          ownerBusinessId: businessId,
          status: "PUBLISHED",
          activityTypes: [],
          ageTags: [],
          visitFormats: [],
        },
      })
    ).id;
  }
  const offer = await db.offer.create({
    data: { kind: "SERVICE", productType: "PLACE_VISIT", title: `Offer ${run}`, placeId, status: "DRAFT", ...extra },
  });
  offerIds.push(offer.id);
  return offer.id;
}

const ownHours = (closedDates: string[]) => ({
  source: "own" as const,
  data: hoursFromSimple({ days: ["MON", "TUE", "WED"], from: "10:00", to: "20:00" }),
  closedDates,
});

test("свой график: правила и закрытые дни записываются в OpeningHours оффера", async () => {
  const offerId = await newOffer();
  await db.$transaction((tx) =>
    applyOfferSchedule({
      db: tx,
      offerId,
      input: { hours: ownHours(["2026-11-07", "2026-10-18"]) },
      externalUrlNeedsModeration: false,
    }),
  );
  const offer = await db.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { openingHours: { include: { rules: { include: { intervals: true } }, exceptions: true } } },
  });
  assert.ok(offer.openingHoursId);
  assert.equal(offer.openingHours?.rules.length, 3);
  assert.deepEqual(
    offer.openingHours?.exceptions.map((item) => [item.date, item.isClosed, item.allDay]).sort(),
    [
      ["2026-10-18", true, true],
      ["2026-11-07", true, true],
    ],
  );
});

test("повторное сохранение заменяет закрытые дни, но не трогает особые часы", async () => {
  const offerId = await newOffer();
  await db.$transaction((tx) =>
    applyOfferSchedule({ db: tx, offerId, input: { hours: ownHours(["2026-10-18"]) }, externalUrlNeedsModeration: false }),
  );
  const { openingHoursId } = await db.offer.findUniqueOrThrow({ where: { id: offerId } });
  await db.openingHoursException.create({
    data: {
      openingHoursId: openingHoursId!,
      date: "2026-12-31",
      isClosed: false,
      allDay: false,
      intervals: { create: [{ startTime: "10:00", endTime: "14:00" }] },
    },
  });
  await db.$transaction((tx) =>
    applyOfferSchedule({ db: tx, offerId, input: { hours: ownHours(["2026-11-07"]) }, externalUrlNeedsModeration: false }),
  );
  const exceptions = await db.openingHoursException.findMany({ where: { openingHoursId: openingHoursId! } });
  assert.deepEqual(exceptions.map((item) => item.date).sort(), ["2026-11-07", "2026-12-31"]);
  // тот же OpeningHours, второй не создан
  assert.equal((await db.offer.findUniqueOrThrow({ where: { id: offerId } })).openingHoursId, openingHoursId);
});

test("«как у места» не удаляет и не создаёт свой график", async () => {
  const offerId = await newOffer();
  await db.$transaction((tx) =>
    applyOfferSchedule({ db: tx, offerId, input: { hours: { source: "place" } }, externalUrlNeedsModeration: false }),
  );
  assert.equal((await db.offer.findUniqueOrThrow({ where: { id: offerId } })).openingHoursId, null);
});

test("график без единого рабочего интервала у открытого дня отклоняется", async () => {
  const offerId = await newOffer();
  const data = hoursFromSimple({ days: ["MON"], from: "10:00", to: "20:00" });
  data.rules[0].intervals = [];
  await assert.rejects(
    db.$transaction((tx) =>
      applyOfferSchedule({
        db: tx,
        offerId,
        input: { hours: { source: "own", data, closedDates: [] } },
        externalUrlNeedsModeration: false,
      }),
    ),
    OfferScheduleValidationError,
  );
});

test("внешняя ссылка: опубликованный оффер партнёра не меняет её напрямую", async () => {
  const offerId = await newOffer();
  const set = (url: string, needsModeration: boolean) =>
    db.$transaction((tx) =>
      applyOfferSchedule({
        db: tx,
        offerId,
        input: { bookingMethod: "EXTERNAL", external: { kind: "TICKETS", url } },
        externalUrlNeedsModeration: needsModeration,
      }),
    );
  await set("https://tickets.example.by/a", false);
  await assert.rejects(set("https://tickets.example.by/b", true), OfferExternalUrlRequiresModerationError);
  // та же ссылка (повторное сохранение формы) не блокируется
  await set("https://tickets.example.by/a", true);
  const booking = await db.offerBooking.findUniqueOrThrow({ where: { offerId } });
  assert.equal(booking.externalUrl, "https://tickets.example.by/a");
  assert.equal(booking.externalKind, "TICKETS");
});

test("NONE и EXTERNAL не создают BookingRequest, REQUEST_ONLY создаёт", async () => {
  const input = {
    publicationType: "OFFER" as const,
    customerName: "Test Parent",
    customerPhone: "+375291112233",
    adultsCount: 1,
    childrenCount: 1,
  };
  for (const mode of ["NONE", "EXTERNAL"] as const) {
    const offerId = await newOffer({
      status: "PUBLISHED",
      bookingEnabled: false,
      bookingMode: mode,
      publishedAt: new Date(),
    });
    await assert.rejects(
      createPublicBooking({ ...input, publicationId: offerId }),
      (error: unknown) => error instanceof BookingValidationError,
    );
    assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
  }
  const requestOffer = await newOffer({
    status: "PUBLISHED",
    bookingEnabled: true,
    bookingMode: "REQUEST_ONLY",
    publishedAt: new Date(),
  });
  await createPublicBooking({ ...input, publicationId: requestOffer });
  assert.equal(await db.bookingRequest.count({ where: { offerId: requestOffer } }), 1);
});

const classInput = (overrides: Record<string, unknown> = {}) => ({
  classSchedule: {
    kind: "recurring" as const,
    durationMin: 60,
    groups: [
      { days: [2, 4], time: "17:30", seats: 8 },
      { days: [6], time: "11:00", seats: null },
    ],
    dates: [],
    period: { from: "2026-10-19", to: "2026-12-14" },
    closedDates: ["2026-11-07"],
    ...overrides,
  },
});

test("регулярные занятия: правила по дням, период курса и закрытые дни в OfferScheduleException", async () => {
  const offerId = await newOffer({ productType: "REGULAR_ACTIVITY" });
  await db.$transaction((tx) =>
    applyOfferSchedule({ db: tx, offerId, input: classInput(), externalUrlNeedsModeration: false }),
  );
  const booking = await db.offerBooking.findUniqueOrThrow({
    where: { offerId },
    include: { rules: true, exceptions: true },
  });
  assert.equal(booking.scheduleKind, "RECURRING_SESSIONS");
  assert.equal(booking.durationMin, 60);
  assert.deepEqual(
    booking.rules.map((rule) => [rule.weekday, rule.startMinutes, rule.endMinutes, rule.capacity]).sort(),
    [
      [2, 1050, 1110, 8],
      [4, 1050, 1110, 8],
      [6, 660, 720, null],
    ],
  );
  assert.ok(booking.rules.every((rule) => rule.validFrom?.toISOString().startsWith("2026-10-19")));
  assert.ok(booking.rules.every((rule) => rule.validTo?.toISOString().startsWith("2026-12-14")));
  assert.deepEqual(booking.exceptions.map((item) => item.date.toISOString().slice(0, 10)), ["2026-11-07"]);
  // закрытые дни занятий не создают OpeningHours
  assert.equal((await db.offer.findUniqueOrThrow({ where: { id: offerId } })).openingHoursId, null);

  // повторное сохранение заменяет правила и закрытые дни, не плодя дубли
  await db.$transaction((tx) =>
    applyOfferSchedule({
      db: tx,
      offerId,
      input: classInput({ groups: [{ days: [1], time: "09:00", seats: 5 }], period: null, closedDates: [] }),
      externalUrlNeedsModeration: false,
    }),
  );
  const after = await db.offerBooking.findUniqueOrThrow({ where: { offerId }, include: { rules: true, exceptions: true } });
  assert.deepEqual(after.rules.map((rule) => [rule.weekday, rule.startMinutes, rule.validFrom]), [[1, 540, null]]);
  assert.equal(after.exceptions.length, 0);
});

test("разовые занятия: OfferSession по датам в часовом поясе Минска, занятые сессии не удаляются", async () => {
  const offerId = await newOffer({ productType: "ONE_TIME_ACTIVITY" });
  const input = (dates: Array<{ date: string; time: string; seats: number | null }>) => ({
    classSchedule: { kind: "dated" as const, durationMin: 90, groups: [], dates, period: null, closedDates: [] },
  });
  await db.$transaction((tx) =>
    applyOfferSchedule({
      db: tx,
      offerId,
      input: input([
        { date: "2026-10-17", time: "12:00", seats: 10 },
        { date: "2026-10-24", time: "12:00", seats: null },
      ]),
      externalUrlNeedsModeration: false,
    }),
  );
  const sessions = await db.offerSession.findMany({ where: { offerId }, orderBy: { startAt: "asc" } });
  assert.equal((await db.offerBooking.findUniqueOrThrow({ where: { offerId } })).scheduleKind, "DATED_SESSIONS");
  // 12:00 по Минску (UTC+3) = 09:00 UTC, занятие 90 минут
  assert.deepEqual(sessions.map((row) => row.startAt.toISOString()), ["2026-10-17T09:00:00.000Z", "2026-10-24T09:00:00.000Z"]);
  assert.deepEqual(sessions.map((row) => row.endAt.toISOString()), ["2026-10-17T10:30:00.000Z", "2026-10-24T10:30:00.000Z"]);
  assert.deepEqual(sessions.map((row) => row.capacity), [10, null]);

  // на первую дату есть заявка: при удалении даты из расписания сессия отменяется, а не удаляется
  await db.bookingRequest.create({
    data: {
      businessId,
      publicationType: "OFFER",
      offerId,
      offerSessionId: sessions[0].id,
      customerName: "Parent",
      customerPhone: "+375291112233",
    },
  });
  await db.$transaction((tx) =>
    applyOfferSchedule({
      db: tx,
      offerId,
      input: input([{ date: "2026-10-31", time: "12:00", seats: 6 }]),
      externalUrlNeedsModeration: false,
    }),
  );
  const rows = await db.offerSession.findMany({ where: { offerId }, orderBy: { startAt: "asc" } });
  assert.deepEqual(
    rows.map((row) => [row.startAt.toISOString().slice(0, 10), row.isCancelled]),
    [
      ["2026-10-17", true],
      ["2026-10-31", false],
    ],
  );
});

test("расписание занятий не меняет способ записи", async () => {
  const offerId = await newOffer({ productType: "REGULAR_ACTIVITY", bookingEnabled: true, bookingMode: "REQUEST_ONLY" });
  await db.$transaction((tx) =>
    applyOfferSchedule({ db: tx, offerId, input: classInput(), externalUrlNeedsModeration: false }),
  );
  const offer = await db.offer.findUniqueOrThrow({ where: { id: offerId } });
  assert.equal(offer.bookingEnabled, true);
  assert.equal(offer.bookingMode, "REQUEST_ONLY");
});

test("разные периоды одного слота переживают загрузку, изменение мест и повторное сохранение", async () => {
  const offerId = await newOffer({ productType: "REGULAR_ACTIVITY" });
  const booking = await db.offerBooking.create({ data: { offerId, scheduleKind: "RECURRING_SESSIONS", durationMin: 60 } });
  const originals = [
    { weekday: 1, startMinutes: 1020, endMinutes: 1080, capacity: 10, validFrom: new Date("2026-10-01Z"), validTo: new Date("2026-10-31Z") },
    { weekday: 1, startMinutes: 1020, endMinutes: 1080, capacity: 10, validFrom: new Date("2026-11-01Z"), validTo: new Date("2026-11-30Z") },
    { weekday: 3, startMinutes: 1080, endMinutes: 1140, capacity: null, validFrom: null, validTo: null },
    { weekday: 5, startMinutes: 1020, endMinutes: 1080, capacity: 8, validFrom: null, validTo: new Date("2026-12-31Z") },
  ];
  await db.offerScheduleRule.createMany({ data: originals.map(rule => ({ ...rule, offerBookingId: booking.id })) });
  const signature = (rules: typeof originals) => rules.map(rule => JSON.stringify({
    weekday: rule.weekday, startMinutes: rule.startMinutes, endMinutes: rule.endMinutes,
    validFrom: rule.validFrom?.toISOString().slice(0, 10) ?? null,
    validTo: rule.validTo?.toISOString().slice(0, 10) ?? null,
  })).sort();
  for (let pass = 0; pass < 2; pass++) {
    const stored = await db.offerScheduleRule.findMany({ where: { offerBookingId: booking.id } });
    const form = { ...defaultClassSchedule(), ...groupsFromRules(stored) };
    form.groups.find(group => group.period?.from === "2026-11-01")!.seats = "12";
    const classSchedule = buildClassScheduleInput(form, [], "REGULAR_ACTIVITY", "60")!;
    await db.$transaction(tx => applyOfferSchedule({ db: tx, offerId, input: { classSchedule }, externalUrlNeedsModeration: false }));
    const saved = await db.offerScheduleRule.findMany({ where: { offerBookingId: booking.id } });
    assert.deepEqual(signature(saved), signature(originals));
    assert.equal(saved.find(rule => rule.validFrom?.toISOString().startsWith("2026-11-01"))?.capacity, 12);
  }
});

test("конфликтующие правила отклоняются без частичной потери существующего расписания", async () => {
  const offerId = await newOffer({ productType: "REGULAR_ACTIVITY" });
  const first = { kind: "recurring" as const, durationMin: 60, dates: [], closedDates: ["2026-12-01"], period: null,
    groups: [{ days: [1], time: "17:00", seats: 10, period: { from: "2026-10-01", to: "2026-10-31" } }] };
  await db.$transaction(tx => applyOfferSchedule({ db: tx, offerId, input: { classSchedule: first }, externalUrlNeedsModeration: false }));
  const booking = await db.offerBooking.findUniqueOrThrow({ where: { offerId } });
  const before = await db.offerScheduleRule.findMany({ where: { offerBookingId: booking.id } });
  const exceptions = await db.offerScheduleException.findMany({ where: { offerBookingId: booking.id } });
  await assert.rejects(db.$transaction(tx => applyOfferSchedule({
    db: tx, offerId, externalUrlNeedsModeration: false,
    input: { classSchedule: { ...first, closedDates: [], groups: [first.groups[0], { ...first.groups[0], seats: 20 }] } },
  })), OfferScheduleValidationError);
  assert.deepEqual(await db.offerScheduleRule.findMany({ where: { offerBookingId: booking.id } }), before);
  assert.deepEqual(await db.offerScheduleException.findMany({ where: { offerBookingId: booking.id } }), exceptions);
});
