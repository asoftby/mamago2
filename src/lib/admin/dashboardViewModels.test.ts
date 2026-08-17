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

  console.log("dashboardViewModels.test.ts: OK");
}

main();
