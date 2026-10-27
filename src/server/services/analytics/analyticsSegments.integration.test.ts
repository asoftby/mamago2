/**
 * Segments tab on UserEvent-based numbers (ТЗ «Аналитика админки», D1-D3):
 *   - trends = active segment users in the last completed 7/30 Minsk days vs the previous ones,
 *     independent of the selected period; prev = 0 -> null ("—");
 *   - averages = events inside the selected period, not lifetime profile totals;
 *   - daily chart = distinct active users per Minsk day; staff are excluded everywhere.
 * Isolated by a throwaway city: every fixture event carries its cityId.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/analyticsSegments.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getAnalyticsSegmentDetail, getAnalyticsSegments, trendPct } from "./analyticsSegments.service";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

const marker = randomUUID().slice(0, 8);
const userIds: string[] = [];
let cityId: string | null = null;
let countryId: string | null = null;

// Wed 18 Mar 2020 12:00 Minsk. 7d range starts Wed 12 Mar 00:00 Minsk;
// completed 7d window = 11..17 Mar, previous = 4..10 Mar; completed 30d = 17 Feb..17 Mar.
const NOW = new Date("2020-03-18T09:00:00.000Z");

const at = (iso: string) => new Date(iso);

async function main() {
  try {
    // trendPct unit cases
    assert.equal(trendPct(3, 2), 50);
    assert.equal(trendPct(0, 4), -100);
    assert.equal(trendPct(5, 0), null, "no previous activity -> no percentage");
    assert.equal(trendPct(0, 0), null);

    const country = await prisma.country.create({ data: { name: `Seg ${marker}`, slug: `seg-country-${marker}` } });
    countryId = country.id;
    const city = await prisma.city.create({ data: { countryId: country.id, name: `Seg ${marker}`, slug: `seg-${marker}` } });
    cityId = city.id;
    const slug = city.slug;

    async function makeUser(role: "USER" | "ADMIN", segments: string[], lastSeenAt: Date, totals = 0) {
      const user = await prisma.user.create({ data: { email: `seg-${marker}-${randomUUID()}@example.invalid`, role } });
      userIds.push(user.id);
      await prisma.userBehaviorProfile.create({
        data: { userId: user.id, segmentKeys: segments, lastSeenAt, totalSaves: totals, totalPlanAdds: totals, totalCtaClicks: totals },
      });
      return user.id;
    }
    async function ev(userId: string, eventType: "SAVE" | "PLAN_ADD" | "CTA_CLICK" | "CARD_VIEW" | "PAGE_VIEW", iso: string) {
      await prisma.userEvent.create({ data: { userId, eventType, cityId, createdAt: at(iso), sessionId: `seg-${marker}-${randomUUID()}` } });
    }

    const PS = ["PRICE_SENSITIVE"];
    // u1: active in the previous window (5 Mar) and the current one; lifetime totals are huge on purpose.
    const u1 = await makeUser("USER", PS, at("2020-03-15T10:00:00Z"), 100);
    await ev(u1, "SAVE", "2020-03-13T10:00:00Z");
    await ev(u1, "PLAN_ADD", "2020-03-14T10:00:00Z");
    await ev(u1, "CTA_CLICK", "2020-03-15T10:00:00Z");
    await ev(u1, "PAGE_VIEW", "2020-03-05T10:00:00Z");
    // u2: only in the previous window; last seen before the selected 7d period.
    const u2 = await makeUser("USER", PS, at("2020-03-06T10:00:00Z"), 100);
    await ev(u2, "PAGE_VIEW", "2020-03-06T10:00:00Z");
    // u3: two saves on the same day (counts once in the daily chart); also in the SAVER segment.
    const u3 = await makeUser("USER", [...PS, "SAVER"], at("2020-03-16T11:00:00Z"), 100);
    await ev(u3, "SAVE", "2020-03-16T10:00:00Z");
    await ev(u3, "SAVE", "2020-03-16T11:00:00Z");
    // u4: late evening 17 Mar Minsk (20:30Z) = still inside the completed week; one feed impression.
    const u4 = await makeUser("USER", PS, at("2020-03-17T20:30:00Z"));
    await ev(u4, "CARD_VIEW", "2020-03-17T20:30:00Z");
    // u5: 00:30 on 18 Mar Minsk (= 21:30Z on 17 Mar): "today" in Minsk, NOT in the completed window.
    const u5 = await makeUser("USER", PS, at("2020-03-17T21:30:00Z"));
    await ev(u5, "PAGE_VIEW", "2020-03-17T21:30:00Z");
    // staff: never counted.
    const admin = await makeUser("ADMIN", PS, at("2020-03-16T10:00:00Z"), 50);
    await ev(admin, "SAVE", "2020-03-16T10:00:00Z");
    await ev(admin, "PAGE_VIEW", "2020-03-05T10:00:00Z");

    const filters = { dateRange: "7d" as const, city: slug };
    const list = await getAnalyticsSegments(filters, NOW);
    const ps = list.segments.find((s) => s.key === "PRICE_SENSITIVE")!;
    assert.equal(list.totalProfiles, 4, "period members: u1, u3, u4, u5 (u2 last seen before the period, admin excluded)");
    assert.equal(ps.usersCount, 4);
    // D3: 1 save (u1) + 2 saves (u3) = 3 over 4 users in the period; lifetime totals (100 each) are ignored.
    assert.equal(ps.avgSaves, 0.75);
    assert.equal(ps.avgPlanAdds, 0.25);
    assert.equal(ps.avgCtaClicks, 0.25);
    // D1: completed 7d = {u1, u3, u4} (u5's 00:30 event is "today"), previous 7d = {u1, u2} -> +50%.
    assert.equal(ps.trend7d, 50);
    assert.equal(ps.trend30d, null, "nobody active in the previous completed 30 days -> no percentage");
    const saver = list.segments.find((s) => s.key === "SAVER")!;
    assert.equal(saver.usersCount, 1);
    assert.equal(saver.trend7d, null, "no previous activity -> null, not +N x 100%");

    // The trend does not depend on the selected period: a 30d filter gives the same 7d trend.
    const list30 = await getAnalyticsSegments({ dateRange: "30d", city: slug }, NOW);
    assert.equal(list30.segments.find((s) => s.key === "PRICE_SENSITIVE")!.trend7d, 50);
    assert.equal(list30.segments.find((s) => s.key === "PRICE_SENSITIVE")!.usersCount, 5, "30d period also contains u2");

    // Empty city -> zeros and nulls, no division by zero.
    const empty = await getAnalyticsSegments({ dateRange: "7d", city: `no-such-${marker}` }, NOW);
    assert.ok(empty.segments.every((s) => s.avgSaves === 0 || Number.isFinite(s.avgSaves)));

    // D2 + D3 on the detail page.
    const detail = (await getAnalyticsSegmentDetail("price-sensitive", filters, NOW))!;
    assert.equal(detail.usersCount, 4);
    assert.equal(detail.avgSaves, 0.75);
    assert.equal(detail.funnel.saves, 3);
    assert.equal(detail.funnel.planAdds, 1);
    assert.equal(detail.funnel.ctaClicks, 1);
    assert.equal(detail.funnel.views, 1, "feed impressions in the period");
    const day = (d: string) => detail.trend.find((t) => t.date === d)?.usersCount;
    assert.equal(day("2020-03-16"), 1, "u3's two events on one day count once; the admin is excluded");
    assert.equal(day("2020-03-17"), 1, "u4 at 23:30 Minsk");
    assert.equal(day("2020-03-18"), 1, "u5 at 00:30 Minsk belongs to 18 Mar, not the UTC date 17 Mar");
    assert.equal(day("2020-03-12"), 0);
    assert.equal(detail.trend.length, 7);

    console.log("analyticsSegments.integration.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { userId: { in: userIds } } });
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
