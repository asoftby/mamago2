import assert from "node:assert/strict";
import test from "node:test";
import prisma from "@/lib/prisma";
import { getPromotionPerformanceByActivityIds } from "./boostPerformance.service";

const prefix = `boost-performance-${Date.now()}`;
let ownerUserId = "";
let businessId = "";
let activityId = "";

async function recordEvents(
  createdAt: Date,
  events: Array<"CARD_VIEW" | "DETAIL_OPEN" | "SAVE" | "PLAN_ADD" | "CTA_CLICK">,
) {
  await prisma.userEvent.createMany({
    data: events.map((eventType) => ({
      eventType,
      entityType: "EVENT",
      entityId: activityId,
      createdAt,
    })),
  });
}

test.before(async () => {
  const owner = await prisma.user.create({
    data: { email: `${prefix}@example.invalid`, role: "BUSINESS_OWNER" },
  });
  ownerUserId = owner.id;

  const business = await prisma.business.create({
    data: { name: prefix, ownerUserId, status: "APPROVED", operationalStatus: "ACTIVE" },
  });
  businessId = business.id;

  const activity = await prisma.activity.create({
    data: {
      ownerUserId,
      businessId,
      title: prefix,
      shortDesc: "fixture",
      type: "EVENT",
      scheduleMode: "ONE_TIME",
    },
  });
  activityId = activity.id;

  await prisma.boost.createMany({
    data: [
      {
        activityId,
        businessId,
        startAt: new Date("2026-08-10T10:00:00.000Z"),
        endAt: new Date("2026-08-12T10:00:00.000Z"),
        durationDays: 2,
      },
      {
        activityId,
        businessId,
        startAt: new Date("2026-08-21T09:00:00.000Z"),
        endAt: new Date("2026-08-22T09:00:00.000Z"),
        durationDays: 1,
      },
    ],
  });

  await recordEvents(new Date("2026-08-09T12:00:00.000Z"), ["CARD_VIEW", "CARD_VIEW", "DETAIL_OPEN", "PLAN_ADD"]);
  await recordEvents(new Date("2026-08-11T12:00:00.000Z"), [
    "CARD_VIEW",
    "CARD_VIEW",
    "CARD_VIEW",
    "CARD_VIEW",
    "CARD_VIEW",
    "CARD_VIEW",
    "DETAIL_OPEN",
    "DETAIL_OPEN",
    "SAVE",
    "SAVE",
    "PLAN_ADD",
    "PLAN_ADD",
    "PLAN_ADD",
    "CTA_CLICK",
  ]);
  await recordEvents(new Date("2026-08-21T07:00:00.000Z"), ["CARD_VIEW", "DETAIL_OPEN"]);
  await recordEvents(new Date("2026-08-21T10:00:00.000Z"), [
    "CARD_VIEW",
    "CARD_VIEW",
    "CARD_VIEW",
    "DETAIL_OPEN",
    "DETAIL_OPEN",
    "PLAN_ADD",
  ]);
});

test.after(async () => {
  await prisma.userEvent.deleteMany({ where: { entityId: activityId } });
  await prisma.boost.deleteMany({ where: { activityId } });
  await prisma.activity.deleteMany({ where: { id: activityId } });
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.user.deleteMany({ where: { id: ownerUserId } });
  await prisma.$disconnect();
});

test("returns sorted Boost history with separated impressions/opens and an equal preceding baseline", async () => {
  const result = await getPromotionPerformanceByActivityIds(
    [activityId],
    new Date("2026-08-21T12:00:00.000Z"),
  );
  const performance = result.get(activityId);

  assert.ok(performance);
  assert.equal(performance.isPromoted, true);
  assert.equal(performance.periods.length, 2);

  const [active, completed] = performance.periods;
  assert.equal(active?.isActive, true);
  assert.equal(active?.metrics.views, 3);
  assert.equal(active?.metrics.opens, 2);
  assert.equal(active?.metrics.planAdds, 1);
  assert.equal(active?.baselineMetrics.views, 1);
  assert.equal(active?.baselineMetrics.opens, 1);
  assert.equal(active?.baselineMetrics.planAdds, 0);
  assert.equal(active?.comparison.viewsMultiplier, 3);
  assert.equal(active?.comparison.planAddsPercentChange, null);

  assert.equal(completed?.isActive, false);
  assert.equal(completed?.metrics.views, 6);
  assert.equal(completed?.metrics.opens, 2);
  assert.equal(completed?.metrics.saves, 2);
  assert.equal(completed?.metrics.planAdds, 3);
  assert.equal(completed?.metrics.ctaClicks, 1);
  assert.equal(completed?.baselineMetrics.views, 2);
  assert.equal(completed?.baselineMetrics.opens, 1);
  assert.equal(completed?.baselineMetrics.planAdds, 1);
  assert.equal(completed?.comparison.viewsMultiplier, 3);
  assert.equal(completed?.comparison.planAddsPercentChange, 200);
});

test("returns an empty, non-promoted shape for events without Boost history", async () => {
  const result = await getPromotionPerformanceByActivityIds(
    ["unknown-activity"],
    new Date("2026-08-21T12:00:00.000Z"),
  );
  assert.deepEqual(result.get("unknown-activity"), {
    periods: [],
    latestPeriod: null,
    isPromoted: false,
  });
});
