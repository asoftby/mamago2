/**
 * growthDashboardViewModel.ts tests — no DB required.
 * Run: npx tsx src/lib/admin/growthDashboardViewModel.test.ts
 */
import assert from "node:assert/strict";

import { deriveGrowthOverview, deriveOrganicRecovery, MIN_RATE_SAMPLE } from "./growthDashboardViewModel";

// --- Organic recovery: collected weeks + config fallback ----------------------
{
  const model = deriveOrganicRecovery({
    "seo.evergreen_weekly": { "2026-W37": 600, "2026-W38": 700 },
    "seo.total_weekly": { "2026-W38": 1400 },
  });
  assert.equal(model.latestWeek, "2026-W38");
  assert.equal(model.actual, 700);
  assert.equal(model.baseline, 1458);
  assert.ok(model.share !== null && Math.abs(model.share - 700 / 1458) < 1e-9);
  assert.equal(model.weekChangePercent, 16.7, "700 vs 600");
  assert.equal(model.gateWeek, "2026-W44");
  assert.equal(model.gateTargetClicks, 1513, "80% of the W44 baseline 1891");
  assert.equal(model.weeksLeft, 6);
  assert.equal(model.weeksMeasured, 3, "W36 comes from the config, W37-W38 from the collector");
  assert.equal(model.highNoise, false);
  assert.equal(model.totalClicksLatestWeek, 1400);
  assert.ok(model.targetShareNow !== null && model.targetShareNow > 0.42 && model.targetShareNow < 0.43);
  assert.equal(model.onTrack, true);
  assert.ok(model.requiredWeeklyGrowth !== null && model.requiredWeeklyGrowth > 0);

  assert.deepEqual(
    model.series.map((p) => p.isoWeek),
    ["2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40", "2026-W41", "2026-W42", "2026-W43", "2026-W44"],
  );
  assert.equal(model.series[0].actual, 529);
  assert.equal(model.series[0].trajectory, 529, "the path starts at the first measured week");
  assert.equal(model.series[8].trajectory, 1513, "the path ends at the gate");
  assert.equal(model.series[5].actual, null, "future weeks are unmeasured, not 0");
}

// --- Collected value overrides the hand-entered config week ---------------
{
  const model = deriveOrganicRecovery({ "seo.evergreen_weekly": { "2026-W36": 540 } });
  assert.equal(model.series[0].actual, 540);
}

// --- Empty snapshot: config week only, flagged as noisy, no fake zeros ------
{
  const model = deriveOrganicRecovery({});
  assert.equal(model.latestWeek, "2026-W36");
  assert.equal(model.actual, 529);
  assert.equal(model.weekChangePercent, null);
  assert.equal(model.highNoise, true);
  assert.equal(model.totalClicksLatestWeek, null);
}

// --- Garbage in the snapshot is ignored ---------------------------------------
{
  const model = deriveOrganicRecovery({
    "seo.evergreen_weekly": { "2026-W37": -5, "not-a-week": 10, "2026-W38": "12" },
  });
  assert.equal(model.latestWeek, "2026-W36");
}

// --- Behind the trajectory ----------------------------------------------------
{
  const model = deriveOrganicRecovery({ "seo.evergreen_weekly": { "2026-W37": 500, "2026-W38": 450 } });
  assert.equal(model.onTrack, false);
  assert.ok(model.weekChangePercent !== null && model.weekChangePercent < 0);
}

// --- Growth overview --------------------------------------------------------
{
  const model = deriveGrowthOverview({
    "planning.wpf": 12,
    "planning.wpf_prev": 10,
    "audience.wau": 400,
    "audience.wau_prev": 500,
    "audience.mau": 1500,
    "audience.mau_prev": 1500,
    "audience.dau": 70,
    "audience.wau_weekly": [
      { isoWeek: "2026-W37", value: 380 },
      { isoWeek: "2026-W38", value: 400 },
    ],
    "funnel.engaged_users": MIN_RATE_SAMPLE - 1,
    "funnel.plan_rate": 0.5,
    "supply.active_events": 120,
    "b2b.active_businesses": 60,
  });
  assert.equal(model.wpf, 12);
  assert.equal(model.wpfWoWPercent, 20);
  assert.ok(model.planningPenetration !== null && Math.abs(model.planningPenetration - 0.03) < 1e-9);
  assert.equal(model.wauWoWPercent, -20);
  assert.equal(model.mauMoMPercent, 0);
  assert.deepEqual(model.wauSeries, [380, 400]);
  assert.deepEqual(model.wpfSeries, []);
  assert.equal(model.ratesReliable, false);
  assert.equal(model.planRate, null, "rates are hidden below the minimum sample");
  assert.equal(model.activeEvents, 120);
  assert.equal(model.activePlaces, null);
  assert.equal(model.activeBusinesses, 60);
}

{
  const model = deriveGrowthOverview({ "funnel.engaged_users": MIN_RATE_SAMPLE, "funnel.plan_rate": 0.25 });
  assert.equal(model.ratesReliable, true);
  assert.equal(model.planRate, 0.25);
}

{
  const model = deriveGrowthOverview({});
  assert.equal(model.wpf, null);
  assert.equal(model.wau, null);
  assert.equal(model.w1, null);
  assert.equal(model.ratesReliable, false);
}

console.log("growthDashboardViewModel.test.ts: OK");
