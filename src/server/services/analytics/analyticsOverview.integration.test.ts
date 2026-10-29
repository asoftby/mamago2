/**
 * Analytics → Overview on the unified definitions (ТЗ «Аналитика админки», B):
 *   - visitors / page views / devices equal computeCanonicalAudience for the same window (as on /admin);
 *   - CARD_VIEW is reported as feed impressions, never as page views;
 *   - internal traffic (admin, incl. their pre-login session rows) is in no number;
 *   - an event at 01:30 Minsk is "today".
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/analyticsOverview.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getAnalyticsOverview } from "./analyticsOverview.service";
import { computeCanonicalAudience } from "./canonicalAudience";
import { resolveAnalyticsDateRange } from "./analyticsDateRange";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

const marker = randomUUID().slice(0, 8);
const sid = (label: string) => `ov-${marker}-${label}`;
const userIds: string[] = [];

const filters: AnalyticsOverviewFilters = {
  dateRange: "today",
  entity: "all",
  vertical: "all",
  city: "",
  segment: "",
  childAgeBand: "",
};

async function main() {
  try {
    const user = await prisma.user.create({ data: { email: `ov-${marker}-u@example.invalid` } });
    const admin = await prisma.user.create({ data: { email: `ov-${marker}-a@example.invalid`, role: "ADMIN" } });
    userIds.push(user.id, admin.id);

    const { start } = resolveAnalyticsDateRange("today");
    // As close to Minsk midnight as possible but still "today": the first minutes after 00:00 Minsk.
    const at = (s: number) => new Date(start.getTime() + 60_000 + s * 1000);
    const ev = (data: Parameters<typeof prisma.userEvent.create>[0]["data"]) => prisma.userEvent.create({ data });

    const before = await getAnalyticsOverview(filters);

    // Eligible visitor: 2 page views, 1 card impression, 1 open, 1 save.
    await ev({ eventType: "PAGE_VIEW", createdAt: at(1), sessionId: sid("u"), userId: user.id });
    await ev({ eventType: "PAGE_VIEW", createdAt: at(2), sessionId: sid("u"), userId: user.id });
    await ev({ eventType: "CARD_VIEW", createdAt: at(3), sessionId: sid("u"), userId: user.id, entityType: "EVENT", entityId: `e-${marker}` });
    await ev({ eventType: "DETAIL_OPEN", createdAt: at(4), sessionId: sid("u"), userId: user.id, entityType: "EVENT", entityId: `e-${marker}` });
    await ev({ eventType: "SAVE", createdAt: at(5), sessionId: sid("u"), userId: user.id, entityType: "EVENT", entityId: `e-${marker}` });
    // Admin: anonymous before login on the same session, then logged in — all excluded.
    await ev({ eventType: "PAGE_VIEW", createdAt: at(6), sessionId: sid("a") });
    await ev({ eventType: "DETAIL_OPEN", createdAt: at(7), sessionId: sid("a"), entityType: "EVENT", entityId: `e-${marker}` });
    await ev({ eventType: "PAGE_VIEW", createdAt: at(8), sessionId: sid("a"), userId: admin.id });
    await ev({ eventType: "SAVE", createdAt: at(9), sessionId: sid("a"), userId: admin.id, entityType: "EVENT", entityId: `e-${marker}` });

    const after = await getAnalyticsOverview(filters);
    const range = { start: new Date(after.range.start), end: new Date(after.range.end) };
    const canonical = await computeCanonicalAudience(prisma, range.start, new Date(range.end.getTime() + 1));

    assert.equal(after.visitors, canonical.visitors, "visitors are the canonical /admin definition");
    assert.equal(after.pageViews, canonical.pageViews, "page views are the canonical /admin definition");
    assert.equal(after.devices, canonical.devices);
    assert.equal(after.visitors - before.visitors, 1, "admin traffic adds no visitor");
    assert.equal(after.pageViews - before.pageViews, 2, "only PAGE_VIEW, admin excluded (incl. pre-login)");
    assert.equal(after.devices - before.devices, 1);
    assert.equal(after.feedImpressions - before.feedImpressions, 1, "CARD_VIEW is a feed impression, not a page view");
    assert.equal(after.opens - before.opens, 1, "admin's pre-login open is excluded by session tainting");
    assert.equal(after.saves - before.saves, 1);

    const todayKey = after.dailySeries.at(-1)!;
    const beforeToday = before.dailySeries.at(-1)!;
    assert.equal(todayKey.pageViews - beforeToday.pageViews, 2, "events just after 00:00 Minsk land in today's bucket");
    assert.equal(after.dailySeries.length, 1, "'today' is one Minsk day");

    console.log("analyticsOverview.integration.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { OR: [{ sessionId: { startsWith: `ov-${marker}-` } }, { userId: { in: userIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
