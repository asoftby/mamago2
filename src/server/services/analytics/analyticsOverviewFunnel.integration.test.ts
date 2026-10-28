/**
 * Overview + Funnels on one user-level, time-ordered funnel (ТЗ «Аналитика админки», D6-D8):
 *   - counts are unique people, save/plan/click are shares of openers and never exceed 100%;
 *   - an action BEFORE the first open does not count towards the branch;
 *   - zero openers -> rates are null ("—"), no division by zero;
 *   - the segment filter reaches the overview (D6), and both tabs return the same numbers.
 * Isolated by a throwaway city: every fixture event carries its cityId.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/analyticsOverviewFunnel.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getAnalyticsOverview } from "./analyticsOverview.service";
import { getAnalyticsFunnels } from "./analyticsFunnels.service";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

const marker = randomUUID().slice(0, 8);
const SEGMENT = `TST${marker}`;
const userIds: string[] = [];
let cityId = "";
let countryId = "";

type EvType = "CARD_VIEW" | "PAGE_VIEW" | "DETAIL_OPEN" | "SAVE" | "PLAN_ADD" | "CTA_CLICK";

async function main() {
  try {
    const country = await prisma.country.create({ data: { name: `Fn ${marker}`, slug: `fn-country-${marker}` } });
    countryId = country.id;
    const city = await prisma.city.create({ data: { countryId, name: `Fn ${marker}`, slug: `fn-${marker}` } });
    cityId = city.id;

    const base = Date.now() - 60 * 60 * 1000; // one hour ago: inside "7d" whatever the Minsk clock says
    let tick = 0;
    async function ev(who: { userId?: string; sessionId?: string }, eventType: EvType, entityId = `e-${marker}`) {
      tick += 1000;
      await prisma.userEvent.create({
        data: {
          userId: who.userId ?? null,
          sessionId: who.sessionId ?? null,
          eventType,
          cityId,
          entityType: "PLACE",
          entityId,
          createdAt: new Date(base + tick),
        },
      });
    }
    async function makeUser(segments: string[] = []) {
      const u = await prisma.user.create({ data: { email: `fn-${marker}-${randomUUID()}@example.invalid`, role: "USER" } });
      userIds.push(u.id);
      if (segments.length) await prisma.userBehaviorProfile.create({ data: { userId: u.id, segmentKeys: segments } });
      return { userId: u.id };
    }

    const filters = { dateRange: "7d" as const, entity: "all", vertical: "all", city: city.slug, segment: "", childAgeBand: "" };

    // Empty scope: no openers -> rates are null, nothing divides by zero.
    const empty = await getAnalyticsOverview(filters);
    assert.equal(empty.saveRate, null);
    assert.equal(empty.planRate, null);
    assert.equal(empty.clickRate, null);
    assert.deepEqual(empty.funnel.map((s) => s.count), [0, 0, 0, 0, 0]);
    assert.ok(empty.funnel.every((s) => s.percentOfTop === 0));

    // A: the full path, in segment. Several repeated opens/saves must still count as one person.
    const a = await makeUser([SEGMENT]);
    await ev(a, "CARD_VIEW");
    await ev(a, "DETAIL_OPEN");
    await ev(a, "DETAIL_OPEN");
    await ev(a, "SAVE");
    await ev(a, "SAVE");
    await ev(a, "PLAN_ADD");
    await ev(a, "CTA_CLICK");
    // B: saved BEFORE opening -> opener, but not a "saved after open".
    const b = await makeUser();
    await ev(b, "SAVE");
    await ev(b, "DETAIL_OPEN");
    // C: only saw the card, in segment.
    const c = await makeUser([SEGMENT]);
    await ev(c, "CARD_VIEW");
    // D: anonymous browser: opens and goes to the partner.
    const d = { sessionId: `fn-${marker}-anon` };
    await ev(d, "DETAIL_OPEN");
    await ev(d, "DETAIL_OPEN");
    await ev(d, "DETAIL_OPEN");
    await ev(d, "CTA_CLICK");

    const o = await getAnalyticsOverview(filters);
    assert.deepEqual(o.funnel.map((s) => s.count), [4, 3, 1, 1, 2], "people: view, open, save, plan, click");
    assert.equal(o.saveRate, 1 / 3);
    assert.equal(o.planRate, 1 / 3);
    assert.equal(o.clickRate, 2 / 3);
    for (const r of [o.saveRate, o.planRate, o.clickRate]) assert.ok(r! <= 1, "no share above 100%");
    for (const s of o.funnel) assert.ok(s.percentOfTop <= 100);
    // KPI tiles stay raw event counts.
    assert.equal(o.opens, 6);
    assert.equal(o.saves, 3);

    // Funnels tab shows the very same people for the same filters.
    const f = await getAnalyticsFunnels(filters);
    assert.deepEqual(f.globalFunnel.raw, { view: 4, open: 3, save: 1, plan: 1, click: 2 });
    const [, openStep, saveStep, , clickStep] = f.globalFunnel.steps;
    assert.equal(openStep!.pctFromPrevious, 75);
    assert.equal(saveStep!.pctFromPrevious, 33.33, "branch of 'open', not of the previous step");
    assert.equal(clickStep!.pctFromPrevious, 66.67);
    for (const s of f.globalFunnel.steps) assert.ok(s.pctFromPrevious <= 100 && s.pctFromFirst <= 100);
    const entity = f.dropOff.byEntity.openToPlan.concat(f.dropOff.byEntity.openToClick);
    for (const row of entity) assert.ok(row.transitionRate <= 1, "per-entity rate is a share of openers");

    // D6: the segment filter now reaches the overview. Segment = A and C.
    const seg = await getAnalyticsOverview({ ...filters, segment: SEGMENT });
    assert.deepEqual(seg.funnel.map((s) => s.count), [2, 1, 1, 1, 1]);
    assert.equal(seg.saveRate, 1);
    assert.equal(seg.opens, 2, "events of non-segment users (B, D) are gone from the tiles");
    const segF = await getAnalyticsFunnels({ ...filters, segment: SEGMENT });
    assert.deepEqual(segF.globalFunnel.raw, { view: 2, open: 1, save: 1, plan: 1, click: 1 });

    // E: anonymous open followed by authenticated save in the same browser.
    // Both events must count as ONE person, with a converted save branch.
    const e = await makeUser();
    const eSession = `fn-${marker}-login`;
    await ev({ sessionId: eSession }, "DETAIL_OPEN");
    await ev({ userId: e.userId, sessionId: eSession }, "SAVE");
    const linkedOverview = await getAnalyticsOverview(filters);
    assert.deepEqual(linkedOverview.funnel.map((s) => s.count), [5, 4, 2, 1, 2]);
    assert.equal(linkedOverview.saveRate, 1 / 2);
    const linkedFunnels = await getAnalyticsFunnels(filters);
    assert.deepEqual(linkedFunnels.globalFunnel.raw, { view: 5, open: 4, save: 2, plan: 1, click: 2 });

    // A segment nobody belongs to: empty, still no division by zero.
    const none = await getAnalyticsOverview({ ...filters, segment: `NONE${marker}` });
    assert.equal(none.saveRate, null);
    assert.deepEqual(none.funnel.map((s) => s.count), [0, 0, 0, 0, 0]);

    console.log("analyticsOverviewFunnel.integration: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { cityId: cityId || "none" } });
    await prisma.userBehaviorProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (cityId) await prisma.city.deleteMany({ where: { id: cityId } });
    if (countryId) await prisma.country.deleteMany({ where: { id: countryId } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
