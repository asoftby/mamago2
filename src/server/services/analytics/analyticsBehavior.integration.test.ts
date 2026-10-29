/**
 * Behavior buckets by Minsk wall time (ТЗ «Аналитика админки», B2) and internal-traffic exclusion (B1).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/analyticsBehavior.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { averagePlanningProfiles, getAnalyticsBehavior } from "./analyticsBehavior.service";
import { resolveAnalyticsDateRange } from "./analyticsDateRange";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

const marker = randomUUID().slice(0, 8);
const filters: AnalyticsOverviewFilters = { dateRange: "7d", entity: "all", vertical: "all", city: "", segment: "", childAgeBand: "" };

async function main() {
  const userIds: string[] = [];
  const activityIds: string[] = [];
  let categoryId: string | null = null;
  try {
    const admin = await prisma.user.create({ data: { email: `bh-${marker}@example.invalid`, role: "ADMIN" } });
    userIds.push(admin.id);
    const { start } = resolveAnalyticsDateRange("7d");
    // 01:30 Minsk on the first day of the window = 22:30 UTC the previous calendar day.
    const at = new Date(start.getTime() + 90 * 60_000);
    const minskDow = (() => {
      const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Minsk", weekday: "short" }).format(at);
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd) + 1;
    })();

    const before = await getAnalyticsBehavior(filters);
    await prisma.userEvent.create({ data: { eventType: "SAVE", createdAt: at, sessionId: `bh-${marker}-u` } });
    await prisma.userEvent.create({ data: { eventType: "SAVE", createdAt: at, sessionId: `bh-${marker}-a`, userId: admin.id } });
    const after = await getAnalyticsBehavior(filters);

    const delta = (k: string) =>
      after.activityByTime.find((b) => b.key === k)!.events - before.activityByTime.find((b) => b.key === k)!.events;
    assert.equal(delta("night"), 1, "01:30 Minsk is night; admin row excluded");
    assert.equal(delta("evening"), 0, "not the UTC 22:30 evening bucket");
    const dayDelta = (dow: number) =>
      after.activityByDay.find((d) => d.isoDow === dow)!.events - before.activityByDay.find((d) => d.isoDow === dow)!.events;
    assert.equal(dayDelta(minskDow), 1, "weekday is the Minsk calendar day");
    assert.ok(!after.timezoneNote.includes("UTC"));

    // D5: no profiles -> null (not NaN / 0); real averages otherwise.
    assert.deepEqual(averagePlanningProfiles([]), { avgSame: null, avgAdvance: null, avgWeekend: null });
    assert.deepEqual(
      averagePlanningProfiles([
        { sameDayPlanningShare: 0.5, advancePlanningShare: 0.25, weekendShare: 1 },
        { sameDayPlanningShare: 0.1, advancePlanningShare: 0.75, weekendShare: 0 },
      ]),
      { avgSame: 0.3, avgAdvance: 0.5, avgWeekend: 0.5 },
    );

    // D5: age-band counters are aggregated in SQL per user; a user without children lands in "unknown".
    const regular = await prisma.user.create({ data: { email: `bh-reg-${marker}@example.invalid` } });
    userIds.push(regular.id);
    const bandBefore = await getAnalyticsBehavior(filters);
    const base = new Date(start.getTime() + 3 * 3_600_000);
    await prisma.userEvent.createMany({
      data: [
        { eventType: "PAGE_VIEW", userId: regular.id, createdAt: base, sessionId: `bh-${marker}-r1` },
        { eventType: "PAGE_VIEW", userId: regular.id, createdAt: base, sessionId: `bh-${marker}-r1` },
        { eventType: "SAVE", userId: regular.id, createdAt: base, sessionId: `bh-${marker}-r1` },
        { eventType: "PLAN_ADD", userId: regular.id, createdAt: base, sessionId: `bh-${marker}-r1` },
      ],
    });

    // D4: categories come from real events of the period (feed impressions / saves by event category).
    const category = await prisma.eventCategory.create({
      data: { nameRu: `Тест ${marker}`, nameEn: `Test ${marker}`, slug: `bh-cat-${marker}` },
    });
    categoryId = category.id;
    const activity = await prisma.activity.create({
      data: {
        ownerUserId: regular.id,
        scheduleMode: "ONE_TIME",
        shortDesc: "test",
        title: `Behavior test ${marker}`,
        type: "EVENT",
        status: "PUBLISHED",
        eventCategoryId: category.id,
      },
    });
    activityIds.push(activity.id);
    const ent = { entityType: "EVENT" as const, entityId: activity.id, userId: regular.id, sessionId: `bh-${marker}-r1`, createdAt: base };
    await prisma.userEvent.createMany({
      data: [
        { ...ent, eventType: "CARD_VIEW" },
        { ...ent, eventType: "CARD_VIEW" },
        { ...ent, eventType: "SAVE" },
        { ...ent, eventType: "PAGE_VIEW" },
        // outside the period: must not count
        { ...ent, eventType: "CARD_VIEW", createdAt: new Date(start.getTime() - 3_600_000) },
      ],
    });
    const full = await getAnalyticsBehavior(filters);
    const cat = full.categoryBreakdown.find((c) => c.key === category.id);
    assert.ok(cat, "the category with real events appears");
    assert.equal(cat!.label, `Тест ${marker}`, "label is the Russian category name, not an id");
    assert.equal(cat!.views, 2, "two feed impressions in the period");
    assert.equal(cat!.saves, 1);
    assert.equal(cat!.planAdds, 0);
    const unknown = (r: typeof full) => r.ageBreakdown.find((b) => b.band === "unknown")!;
    assert.equal(unknown(full).views - unknown(bandBefore).views, 3, "2 PAGE_VIEW + 1 on the event card");
    assert.equal(unknown(full).saves - unknown(bandBefore).saves, 2);
    assert.equal(unknown(full).planAdds - unknown(bandBefore).planAdds, 1);

    console.log("analyticsBehavior.integration.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { OR: [{ sessionId: { startsWith: `bh-${marker}-` } }, { userId: { in: userIds } }] } });
    await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
    if (categoryId) await prisma.eventCategory.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
