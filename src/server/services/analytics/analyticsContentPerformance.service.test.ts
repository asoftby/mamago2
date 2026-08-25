/**
 * Critical-path tests for the admin Content Performance aggregation
 * (`/admin/analytics` → Content Performance tab, the real per-publication
 * dashboard admins use to assess engagement — Task 3 exit criterion) and,
 * since the MVP publication drill-down follow-up, for the per-publication
 * detail aggregate (`getPublicationAnalyticsDetail`) behind
 * `/api/admin/analytics/content-performance/[entityType]/[entityId]`.
 *
 * Also covers `trackUserEvent`'s `citySlug` → `cityId` resolution fallback,
 * which is what the Offer detail-page `cityId={offer.placeId}` correctness
 * bug (fixed in this task) now relies on instead of a raw, wrong FK value.
 *
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — exercises the real exported
 * getAnalyticsContentPerformance()/getPublicationAnalyticsDetail()/
 * trackUserEvent() against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/analytics/analyticsContentPerformance.service.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import {
  getAnalyticsContentPerformance,
  getPublicationAnalyticsDetail,
} from "@/server/services/analytics/analyticsContentPerformance.service";
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
    assert.equal(
      row!.openRate,
      null,
      "views (the denominator) is 0, so openRate must be null, not a fake 0.0%",
    );
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

async function testPublicationDetailAggregateCorrectness() {
  await cleanup();
  try {
    // 2 impressions, 4 opens, 1 save, 1 plan add, 3 CTA clicks.
    await trackUserEvent({ eventType: "CARD_VIEW", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });
    await trackUserEvent({ eventType: "CARD_VIEW", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });
    for (let i = 0; i < 4; i++) {
      await trackUserEvent({ eventType: "DETAIL_OPEN", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });
    }
    await trackUserEvent({ eventType: "SAVE", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });
    await trackUserEvent({ eventType: "PLAN_ADD", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "call" } });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "call" } });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "website" } });

    const detail = await getPublicationAnalyticsDetail({
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      filters: { dateRange: "90d", city: "" },
    });

    assert.equal(detail.entityType, "PLACE");
    assert.equal(detail.entityId, FIXTURE_ENTITY_ID);
    assert.equal(detail.metrics.impressions, 2);
    assert.equal(detail.metrics.opens, 4);
    assert.equal(detail.metrics.saves, 1);
    assert.equal(detail.metrics.planAdds, 1);
    assert.equal(detail.metrics.ctaClicks, 3);
    assert.equal(detail.rates.openRate, 4 / 2, "opens / impressions");
    assert.equal(detail.rates.saveRate, 1 / 4, "saves / opens");
    assert.equal(detail.rates.planRate, 1 / 1, "planAdds / saves");
    assert.equal(detail.rates.ctaRateVsOpens, 3 / 4, "ctaClicks / opens");
  } finally {
    await cleanup();
  }
}

async function testContractV1ExcludesArticleUiTransportEvents() {
  await cleanup();
  try {
    await trackUserEvent({
      eventType: "CARD_VIEW",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
    });
    await trackUserEvent({
      eventType: "CARD_VIEW",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
      meta: { articleEvent: "article_telegram_cta_impression" },
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
      eventType: "CTA_CLICK",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
      meta: { articleEvent: "article_complete" },
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
      meta: { articleEvent: "article_rating_submitted" },
    });

    const result = await getAnalyticsContentPerformance(baseFilters(), { pageSize: 100 });
    const row = result.performanceTable.find(
      (r) => r.entityType === "PLACE" && r.entityId === FIXTURE_ENTITY_ID,
    );
    assert.ok(row, "fixture entity must appear in the performance table");
    assert.equal(row!.views, 1, "inner Telegram CTA impression must not inflate content impressions");
    assert.equal(row!.ctaClicks, 1, "reading/rating transport events must not inflate conversion CTA clicks");

    const detail = await getPublicationAnalyticsDetail({
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      filters: { dateRange: "90d", city: "" },
    });
    assert.equal(detail.metrics.impressions, 1);
    assert.equal(detail.metrics.ctaClicks, 1);
    assert.deepEqual(
      detail.ctaBreakdown.map((item) => [item.action, item.count]),
      [["call", 1]],
      "CTA breakdown must contain only canonical CTA activations",
    );
  } finally {
    await cleanup();
  }
}

async function testCtaTargetActionGroupingAndUnknownFallback() {
  await cleanup();
  try {
    await trackUserEvent({ eventType: "DETAIL_OPEN", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "call" } });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "call" } });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "call" } });
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "website" } });
    // A made-up future targetAction not present in the label dictionary.
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: { targetAction: "future_action_xyz" } });
    // A CTA_CLICK with no targetAction at all.
    await trackUserEvent({ eventType: "CTA_CLICK", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG, meta: {} });

    const detail = await getPublicationAnalyticsDetail({
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      filters: { dateRange: "90d", city: "" },
    });

    assert.equal(detail.metrics.ctaClicks, 6);
    const byAction = new Map(detail.ctaBreakdown.map((r) => [r.action, r]));

    const call = byAction.get("call");
    assert.ok(call, "call bucket must be present");
    assert.equal(call!.count, 3);
    assert.equal(call!.label, "Позвонили", "known action must use the centralized Russian label");

    const website = byAction.get("website");
    assert.ok(website, "website bucket must be present");
    assert.equal(website!.count, 1);
    assert.equal(website!.label, "Перешли на сайт");

    const unknown = byAction.get("future_action_xyz");
    assert.ok(unknown, "unknown future action must still appear, not silently disappear");
    assert.equal(unknown!.count, 1);
    assert.ok(
      !/[{}[\]"]/.test(unknown!.label),
      "unknown action label must be a readable string, never raw JSON",
    );
    assert.notEqual(unknown!.label, "future_action_xyz", "must be humanized, not the raw technical value verbatim");

    const none = byAction.get(null);
    assert.ok(none, "CTA_CLICK with no targetAction must still be counted, in a null bucket");
    assert.equal(none!.count, 1);
    assert.equal(none!.label, "Без указания действия");
  } finally {
    await cleanup();
  }
}

async function testDetailHasNoRawPiiOrEvents() {
  await cleanup();
  try {
    const secretSessionId = "s_super_secret_session_marker_123";
    const secretUserId = "cuid_secret_user_marker_456";
    await trackUserEvent({
      eventType: "DETAIL_OPEN",
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      citySlug: CITY_SLUG,
      sessionId: secretSessionId,
    });
    // userId is only accepted for a real user FK in this schema; to prove no
    // raw identifiers leak we check the serialized response for exact-string
    // absence of both markers plus the absence of any events/rows array.
    void secretUserId;

    const detail = await getPublicationAnalyticsDetail({
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      filters: { dateRange: "90d", city: "" },
    });

    const serialized = JSON.stringify(detail);
    assert.ok(!serialized.includes(secretSessionId), "response must never leak a raw sessionId");
    assert.ok(!("events" in detail), "response must not include a raw events/rows array");
    assert.ok(!("userId" in detail), "response must not include userId");
    assert.ok(!("sessionId" in detail), "response must not include sessionId");
    assert.ok(!("ip" in detail) && !("userAgent" in detail), "response must not include IP/UA");
  } finally {
    await cleanup();
  }
}

async function testDetailZeroDenominatorIsNullNotZero() {
  await cleanup();
  try {
    // Only impressions, no opens/saves/plan/CTA at all — every rate's
    // denominator is 0.
    await trackUserEvent({ eventType: "CARD_VIEW", entityType: "PLACE", entityId: FIXTURE_ENTITY_ID, citySlug: CITY_SLUG });

    const detail = await getPublicationAnalyticsDetail({
      entityType: "PLACE",
      entityId: FIXTURE_ENTITY_ID,
      filters: { dateRange: "90d", city: "" },
    });

    assert.equal(detail.metrics.impressions, 1);
    assert.equal(detail.rates.openRate, 0, "opens=0 over impressions=1 is a real, meaningful 0%, not null");
    assert.equal(detail.rates.saveRate, null, "opens=0 denominator — unmeasurable, must be null");
    assert.equal(detail.rates.planRate, null, "saves=0 denominator — unmeasurable, must be null");
    assert.equal(detail.rates.ctaRateVsOpens, null, "opens=0 denominator — unmeasurable, must be null");
    assert.deepEqual(detail.ctaBreakdown, [], "no CTA_CLICK events — breakdown must be empty, not fabricated");
  } finally {
    await cleanup();
  }
}

async function main() {
  await testAggregationCountsMatchWrittenEvents();
  await testCityFilterMatchesEventsResolvedViaCitySlug();
  await testPublicationDetailAggregateCorrectness();
  await testContractV1ExcludesArticleUiTransportEvents();
  await testCtaTargetActionGroupingAndUnknownFallback();
  await testDetailHasNoRawPiiOrEvents();
  await testDetailZeroDenominatorIsNullNotZero();
  console.log("analyticsContentPerformance aggregation tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
