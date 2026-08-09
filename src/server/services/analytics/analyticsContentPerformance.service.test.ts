/**
 * Critical-path tests for the admin Content Performance aggregation
 * (`/admin/analytics` → Content Performance tab, the real per-publication
 * dashboard admins use to assess engagement — Task 3 exit criterion).
 *
 * Also covers `trackUserEvent`'s `citySlug` → `cityId` resolution fallback,
 * which is what the Offer detail-page `cityId={offer.placeId}` correctness
 * bug (fixed in this task) now relies on instead of a raw, wrong FK value.
 *
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — exercises the real exported
 * getAnalyticsContentPerformance()/trackUserEvent() against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/analytics/analyticsContentPerformance.service.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { getAnalyticsContentPerformance } from "@/server/services/analytics/analyticsContentPerformance.service";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";

const FIXTURE_ENTITY_ID = "test-fixture-content-performance-place";
const CITY_SLUG = "minsk";

async function cleanup() {
  await prisma.userEvent.deleteMany({ where: { entityId: FIXTURE_ENTITY_ID } });
}

// `entity: "place"` narrows the query to only PLACE-type rows (well under
// the service's 100-row page size on this DB), so the fixture is guaranteed
// to land on page 1 regardless of how it sorts against real production rows
// by "views" (the default sort key) — this test asserts on the fixture's
// own counts, not on its rank.
function baseFilters(overrides: Partial<AnalyticsOverviewFilters> = {}): AnalyticsOverviewFilters {
  return {
    dateRange: "90d",
    entity: "place",
    vertical: "all",
    city: "",
    segment: "",
    childAgeBand: "",
    ...overrides,
  };
}

async function testAggregationCountsMatchWrittenEvents() {
  await cleanup();
  try {
    // 3 opens, 1 CTA click, 1 save for the same fixture entity — no CARD_VIEW,
    // matching Place's real-world signal mix (Place has no impression tracking).
    await trackUserEvent({
      eventType: "DETAIL_OPEN",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
    });
    await trackUserEvent({
      eventType: "DETAIL_OPEN",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
    });
    await trackUserEvent({
      eventType: "DETAIL_OPEN",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
      meta: { targetAction: "call" },
    });
    await trackUserEvent({
      eventType: "SAVE",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
    });

    const result = await getAnalyticsContentPerformance(baseFilters(), { pageSize: 100 });
    const row = result.performanceTable.find(
      (r) => r.entityType === "PLACE" && r.entityId === FIXTURE_ENTITY_ID,
    );
    assert.ok(row, "fixture entity must appear in the performance table");
    assert.equal(row!.opens, 3, "DETAIL_OPEN count must match exactly");
    assert.equal(row!.ctaClicks, 1);
    assert.equal(row!.saves, 1);
    assert.equal(row!.views, 0, "no CARD_VIEW was emitted, so raw views must be 0, not fabricated");
  } finally {
    await cleanup();
  }
}

async function testCityFilterMatchesEventsResolvedViaCitySlug() {
  await cleanup();
  try {
    // Only citySlug given, no cityId — this is exactly the pattern the fixed
    // Offer detail-page beacon now uses instead of the wrong `offer.placeId`.
    await trackUserEvent({
      eventType: "DETAIL_OPEN",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
    });

    const row = await prisma.userEvent.findFirst({ where: { entityId: FIXTURE_ENTITY_ID } });
    assert.ok(row, "event must have been written");
    assert.ok(row!.cityId, "citySlug must resolve to a real cityId, not stay null");

    const result = await getAnalyticsContentPerformance(baseFilters({ city: CITY_SLUG }), { pageSize: 100 });
    const matched = result.performanceTable.some(
      (r) => r.entityType === "PLACE" && r.entityId === FIXTURE_ENTITY_ID,
    );
    assert.ok(matched, "event resolved via citySlug must be found when filtering admin analytics by that city");
  } finally {
    await cleanup();
  }
}

async function main() {
  await testAggregationCountsMatchWrittenEvents();
  await testCityFilterMatchesEventsResolvedViaCitySlug();
  console.log("analyticsContentPerformance aggregation tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
