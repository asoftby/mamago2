import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  OfferExternalUrlRequiresModerationError,
  OfferScheduleValidationError,
  applyOfferSchedule,
} from "./offerSchedule.service";
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
