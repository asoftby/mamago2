/**
 * dashboardViewModels.ts pure derivation tests — no DB required.
 * Run: npx tsx src/lib/admin/dashboardViewModels.test.ts
 */
import assert from "node:assert/strict";
import {
  deriveProductPulse,
  deriveEngagement,
  deriveStageConversion,
  deriveSearchDiscovery,
  deriveWorkload,
  deriveNorthStar,
  deriveHabit,
  deriveEngagementFunnel,
  deriveGrowth,
  deriveSupplyHealth,
  deriveB2BHealth,
  deriveDiscoveryQuality,
  deriveDataQuality,
} from "./dashboardViewModels";

function main() {
  // ---- Product Pulse ----
  {
    const model = deriveProductPulse({ "audience.dau": 120, "audience.wau": 400, "audience.mau": 1000 });
    assert.equal(model.dau, 120);
    assert.equal(model.wau, 400);
    assert.equal(model.mau, 1000);
    assert.equal(model.wauMauRatio, 0.4);
  }
  {
    // MAU = 0 -> ratio unknown, not Infinity/NaN.
    const model = deriveProductPulse({ "audience.dau": 0, "audience.wau": 0, "audience.mau": 0 });
    assert.equal(model.wauMauRatio, null, "MAU=0 must yield an unknown ratio, never a divide-by-zero result");
  }
  {
    // Missing samples stay null, never coerced to 0.
    const model = deriveProductPulse({});
    assert.equal(model.dau, null);
    assert.equal(model.wau, null);
    assert.equal(model.mau, null);
    assert.equal(model.wauMauRatio, null, "missing wau/mau must not derive a ratio");
  }

  // ---- Engagement ----
  {
    const model = deriveEngagement({
      "funnel.content_opens": 50,
      "funnel.saves": 10,
      "funnel.plan_adds": 4,
      "funnel.cta_clicks": 2,
    });
    assert.deepEqual(model, { contentOpens: 50, saves: 10, planAdds: 4, ctaClicks: 2 });
  }
  {
    const model = deriveEngagement({});
    assert.deepEqual(model, { contentOpens: null, saves: null, planAdds: null, ctaClicks: null });
  }
  // Conversion between adjacent stages.
  assert.equal(deriveStageConversion(50, 10), 0.2);
  assert.equal(deriveStageConversion(0, 10), null, "zero denominator must not divide");
  assert.equal(deriveStageConversion(null, 10), null, "unknown numerator side must not divide");
  assert.equal(deriveStageConversion(50, null), null, "unknown denominator side must not divide");

  // ---- Search & Discovery ----
  {
    // Real 0% vs unknown must stay visually distinct.
    const realZero = deriveSearchDiscovery({ "search.queries_total": 5, "search.zero_result_rate": 0 });
    assert.equal(realZero.queriesTotal, 5);
    assert.equal(realZero.zeroResultRate, 0, "a genuinely observed 0% must render as 0%, not unknown");

    const unknownFromZeroQueries = deriveSearchDiscovery({
      "search.queries_total": 0,
      // A stale rate value from a previous non-zero-query cycle must be ignored once queriesTotal is 0.
      "search.zero_result_rate": 0.4,
    });
    assert.equal(unknownFromZeroQueries.queriesTotal, 0);
    assert.equal(unknownFromZeroQueries.zeroResultRate, null, "queriesTotal=0 must present the rate as unknown, not a stale value");

    const noData = deriveSearchDiscovery({});
    assert.equal(noData.queriesTotal, null);
    assert.equal(noData.zeroResultRate, null);
  }

  // ---- Workload ----
  {
    const queues = {
      moderation: {
        place: { size: 3, oldestAgeSec: 100 },
        place_revision: { size: 1, oldestAgeSec: 50 },
        event: { size: 0, oldestAgeSec: 0 },
        offer: { size: 2, oldestAgeSec: 200 },
      },
      import: { reviewSize: 7, failedSources: 0 },
      b2b: { pendingSize: 4 },
    };
    const kpis = { "comms.failed_deliveries_1h": 1 };
    const model = deriveWorkload(queues, kpis);
    assert.equal(model.moderation.place, 3);
    assert.equal(model.moderation.total, 6, "3+1+0+2, disjoint dimensions summed once each — no double counting");
    assert.equal(model.importReviewSize, 7);
    assert.equal(model.b2bPendingSize, 4);
    assert.equal(model.commsFailedDeliveries1h, 1);
  }
  {
    // Partially-collected cycle: total must be unknown, not an under-reported partial sum.
    const queues = {
      moderation: {
        place: { size: 3, oldestAgeSec: 100 },
        place_revision: { size: null, oldestAgeSec: null },
        event: { size: 0, oldestAgeSec: 0 },
        offer: { size: 2, oldestAgeSec: 200 },
      },
    };
    const model = deriveWorkload(queues, {});
    assert.equal(model.moderation.total, null, "one unknown dimension must make the total unknown, not silently partial");
  }
  {
    // Nothing collected at all -> every field unknown, never zero.
    const model = deriveWorkload({}, {});
    assert.equal(model.moderation.place, null);
    assert.equal(model.moderation.total, null);
    assert.equal(model.importReviewSize, null);
    assert.equal(model.b2bPendingSize, null);
    assert.equal(model.commsFailedDeliveries1h, null);
  }

  // ---- North Star (WPF) ----
  {
    const model = deriveNorthStar({ "planning.wpf": 220, "planning.wpf_prev": 200, "audience.wau": 1000 });
    assert.equal(model.wpf, 220);
    assert.equal(model.wpfWoWPercent, 10, "220 vs 200 is +10%");
    assert.equal(model.planningPenetration, 0.22, "220 / 1000");
  }
  {
    const model = deriveNorthStar({});
    assert.equal(model.wpf, null);
    assert.equal(model.wpfWoWPercent, null);
    assert.equal(model.planningPenetration, null);
  }
  {
    // wau known but 0 -> penetration must stay unknown, never Infinity.
    const model = deriveNorthStar({ "planning.wpf": 10, "audience.wau": 0 });
    assert.equal(model.planningPenetration, null);
  }

  // ---- Habit (W1/W4 retention + 3/4-week habit) ----
  {
    const model = deriveHabit({
      "retention.w1": 0.314,
      "retention.w1_prev": 0.282,
      "retention.w4": 0.228,
      "retention.w4_prev": 0.228,
      "habit.3of4week": 0.287,
      "habit.3of4week_prev": 0.255,
    });
    assert.equal(model.w1, 0.314);
    assert.equal(model.w1DeltaPp, 3.2, "percentage-point delta, not relative %");
    assert.equal(model.w4DeltaPp, 0, "identical current/prev must yield exactly 0 pp, not a rounding artifact");
    assert.equal(model.habit3of4DeltaPp, 3.2);
  }
  {
    const model = deriveHabit({});
    assert.equal(model.w1, null);
    assert.equal(model.w1DeltaPp, null, "missing prev must not derive a delta");
    assert.equal(model.habit3of4, null);
    assert.equal(model.habit3of4DeltaPp, null);
  }

  // ---- Engagement Funnel (ordered-intersection rates) ----
  {
    const model = deriveEngagementFunnel({
      "funnel.engaged_users": 12480,
      "funnel.save_rate": 0.39,
      "funnel.plan_rate": 0.236,
      "funnel.cta_rate": 0.095,
    });
    assert.deepEqual(model, { engagedUsers: 12480, saveRate: 0.39, planRate: 0.236, ctaRate: 0.095 });
  }
  {
    const model = deriveEngagementFunnel({ "funnel.engaged_users": 0 });
    assert.equal(model.engagedUsers, 0, "a genuinely observed 0 engaged users must render as 0, not unknown");
    assert.equal(model.saveRate, null, "rates undefined when the collector wrote no rate samples for a zero-engaged cycle");
  }

  // ---- Growth ----
  {
    const model = deriveGrowth({
      "audience.mau": 1100,
      "audience.mau_prev": 1000,
      "audience.wau": 540,
      "audience.wau_prev": 500,
      "planning.wpf": 220,
      "planning.wpf_prev": 200,
    });
    assert.equal(model.mauGrowthPercent, 10);
    assert.equal(model.wauGrowthPercent, 8);
    assert.equal(model.wpfGrowthPercent, 10);
  }
  {
    const model = deriveGrowth({});
    assert.equal(model.mauGrowthPercent, null);
    assert.equal(model.wauGrowthPercent, null);
    assert.equal(model.wpfGrowthPercent, null);
  }

  // ---- Supply Health ----
  {
    const model = deriveSupplyHealth({
      "supply.active_events": 340,
      "supply.active_places": 512,
      "supply.active_offers": 88,
      "supply.content_freshness_pct": 0.87,
    });
    assert.deepEqual(model, { activeEvents: 340, activePlaces: 512, activeOffers: 88, contentFreshnessPct: 0.87 });
  }
  {
    const model = deriveSupplyHealth({});
    assert.deepEqual(model, { activeEvents: null, activePlaces: null, activeOffers: null, contentFreshnessPct: null });
  }

  // ---- B2B Health ----
  {
    const model = deriveB2BHealth({ "b2b.active_businesses": 120, "b2b.new_businesses_30d": 14, "b2b.meaningful_action_rate": 0.42 });
    assert.equal(model.activeBusinesses, 120);
    assert.equal(model.meaningfulActionRate, 0.42);
    assert.equal(model.repeatPromotionRate, null, "explicitly null — paid Promotion is disabled in prod, never a fabricated 0");
    assert.equal(model.revenue, null, "explicitly null — no reliable revenue source yet");
  }

  // ---- Discovery Quality (extends Search & Discovery) ----
  {
    const model = deriveDiscoveryQuality({ "search.queries_total": 100, "search.zero_result_rate": 0.1, "search.action_rate": 0.55 });
    assert.equal(model.queriesTotal, 100);
    assert.equal(model.zeroResultRate, 0.1);
    assert.equal(model.searchActionRate, 0.55);
  }

  // ---- Data Quality ----
  {
    const fresh = deriveDataQuality(false);
    assert.equal(fresh.internalEventsOk, true);
    assert.equal(fresh.ga4Status, "NOT_CONFIGURED");
    assert.equal(fresh.yandexStatus, "NOT_CONFIGURED");
    assert.equal(fresh.overallHealthPercent, 100);

    const stale = deriveDataQuality(true);
    assert.equal(stale.internalEventsOk, false);
    assert.equal(stale.overallHealthPercent, null, "a stale snapshot must never be graded as healthy");
  }

  console.log("dashboardViewModels.test.ts: OK");
}

main();
