import assert from "node:assert/strict";
import test from "node:test";
import prisma from "@/lib/prisma";
import {
  createDailyFreeBoost,
  DailyFreeBoostTargetError,
  DailyFreeBoostUnavailableError,
  getDailyFreeBoostDashboardData,
  getFreeBoostCandidates,
} from "./dailyFreeBoost.service";

const prefix = `daily-free-boost-${Date.now()}`;
let ownerUserId = "";
let businessId = "";
let foreignUserId = "";
let foreignBusinessId = "";
let placeId = "";
let foreignPlaceId = "";
let offerIds: string[] = [];
let foreignOfferId = "";

test.before(async () => {
  const owner = await prisma.user.create({
    data: { email: `${prefix}-owner@example.invalid`, role: "BUSINESS_OWNER" },
  });
  ownerUserId = owner.id;
  const business = await prisma.business.create({
    data: {
      name: `${prefix} business`,
      ownerUserId,
      status: "APPROVED",
      operationalStatus: "ACTIVE",
    },
  });
  businessId = business.id;
  const place = await prisma.place.create({
    data: {
      title: `${prefix} place`,
      shortDesc: "Daily free boost fixture",
      activityTypes: [],
      ageTags: [],
      visitFormats: [],
      createdByUserId: ownerUserId,
      ownerBusinessId: businessId,
      status: "PUBLISHED",
    },
  });
  placeId = place.id;
  const offers = await Promise.all(
    [1, 2, 3].map((index) =>
      prisma.offer.create({
        data: {
          placeId,
          kind: "SERVICE",
          title: `${prefix} offer ${index}`,
          status: "PUBLISHED",
        },
      }),
    ),
  );
  offerIds = offers.map((offer) => offer.id);

  const foreignOwner = await prisma.user.create({
    data: { email: `${prefix}-foreign@example.invalid`, role: "BUSINESS_OWNER" },
  });
  foreignUserId = foreignOwner.id;
  const foreignBusiness = await prisma.business.create({
    data: {
      name: `${prefix} foreign`,
      ownerUserId: foreignUserId,
      status: "APPROVED",
      operationalStatus: "ACTIVE",
    },
  });
  foreignBusinessId = foreignBusiness.id;
  const foreignPlace = await prisma.place.create({
    data: {
      title: `${prefix} foreign place`,
      shortDesc: "Foreign fixture",
      activityTypes: [],
      ageTags: [],
      visitFormats: [],
      createdByUserId: foreignUserId,
      ownerBusinessId: foreignBusinessId,
      status: "PUBLISHED",
    },
  });
  foreignPlaceId = foreignPlace.id;
  const foreignOffer = await prisma.offer.create({
    data: {
      placeId: foreignPlaceId,
      kind: "SERVICE",
      title: `${prefix} foreign offer`,
      status: "PUBLISHED",
    },
  });
  foreignOfferId = foreignOffer.id;
});

test.after(async () => {
  await prisma.userEvent.deleteMany({
    where: { entityId: { in: [...offerIds, foreignOfferId] } },
  });
  await prisma.boost.deleteMany({
    where: { businessId: { in: [businessId, foreignBusinessId] } },
  });
  await prisma.offer.deleteMany({
    where: { id: { in: [...offerIds, foreignOfferId] } },
  });
  await prisma.place.deleteMany({ where: { id: { in: [placeId, foreignPlaceId] } } });
  await prisma.business.deleteMany({
    where: { id: { in: [businessId, foreignBusinessId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ownerUserId, foreignUserId] } },
  });
  await prisma.$disconnect();
});

test("candidate list contains only the business's public publications", async () => {
  const candidates = await getFreeBoostCandidates({ businessId, userId: ownerUserId });
  assert.deepEqual(
    new Set(candidates.map((candidate) => candidate.id)),
    new Set(offerIds),
  );
  assert.equal(candidates.some((candidate) => candidate.id === foreignOfferId), false);
});

test("server allows exactly one free boost per Business calendar day", async () => {
  const now = new Date("2026-08-21T09:00:00.000Z");
  const results = await Promise.allSettled([
    createDailyFreeBoost({
      businessId,
      userId: ownerUserId,
      publicationId: offerIds[0]!,
      publicationType: "OFFER",
      now,
    }),
    createDailyFreeBoost({
      businessId,
      userId: ownerUserId,
      publicationId: offerIds[1]!,
      publicationType: "OFFER",
      now,
    }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.reason instanceof DailyFreeBoostUnavailableError);
  assert.equal(
    await prisma.boost.count({
      where: { businessId, freeDailyDateKey: "2026-08-21", isFreeDaily: true },
    }),
    1,
  );

  const dashboard = await getDailyFreeBoostDashboardData({
    businessId,
    userId: ownerUserId,
    now,
  });
  assert.equal(dashboard.availableToday, false);
  assert.ok(dashboard.boost);

  const metricTime = new Date("2026-08-21T09:01:00.000Z");
  await prisma.userEvent.createMany({
    data: [
      {
        eventType: "CARD_VIEW",
        entityType: "OFFER",
        entityId: dashboard.boost.publicationId,
        createdAt: metricTime,
      },
      {
        eventType: "SAVE",
        entityType: "OFFER",
        entityId: dashboard.boost.publicationId,
        createdAt: metricTime,
      },
      {
        eventType: "CTA_CLICK",
        entityType: "OFFER",
        entityId: dashboard.boost.publicationId,
        createdAt: metricTime,
      },
    ],
  });
  const measured = await getDailyFreeBoostDashboardData({
    businessId,
    userId: ownerUserId,
    now: new Date("2026-08-21T09:02:00.000Z"),
  });
  assert.deepEqual(measured.boost?.metrics, {
    views: 1,
    saves: 1,
    ctaClicks: 1,
  });
});

test("foreign targets are rejected and the next calendar day is available", async () => {
  await assert.rejects(
    createDailyFreeBoost({
      businessId,
      userId: ownerUserId,
      publicationId: foreignOfferId,
      publicationType: "OFFER",
      now: new Date("2026-08-22T09:01:00.000Z"),
    }),
    DailyFreeBoostTargetError,
  );

  const next = await createDailyFreeBoost({
    businessId,
    userId: ownerUserId,
    publicationId: offerIds[2]!,
    publicationType: "OFFER",
    now: new Date("2026-08-22T09:01:00.000Z"),
  });
  assert.equal(next.freeDailyDateKey, "2026-08-22");
});
