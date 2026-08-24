import assert from "node:assert/strict";
import test from "node:test";
import { planBackfill } from "./backfill-normalized-publication-prices";

const states = (mode: "UNKNOWN" | "EXACT" = "UNKNOWN") => ({ Activity: [{ id: "a", priceMode: mode, priceFrom: null, priceTo: null, currency: "BYN" }], Offer: [{ id: "o", priceMode: "UNKNOWN" as const, priceFrom: 20, priceTo: null, currency: "BYN" }], Place: [{ id: "p", priceMode: "UNKNOWN" as const, priceFrom: null, priceTo: null, currency: "BYN" }] });

test("plans deterministic modes and never includes manual review", () => {
  const rows = [
    { entity: "Activity" as const, id: "a", classification: "AUTO_SAFE" as const, proposed: { mode: "FREE" as const, min: 0, max: 0, currency: "BYN" } },
    { entity: "Offer" as const, id: "o", classification: "RECOVERABLE" as const, proposed: { mode: "FROM" as const, min: 30, max: null, currency: "BYN" } },
    { entity: "Place" as const, id: "p", classification: "NONE" as const, proposed: { mode: "NONE" as const, min: null, max: null, currency: "BYN" } },
    { entity: "Place" as const, id: "manual", classification: "MANUAL_REVIEW" as const, proposed: { mode: "UNKNOWN" as const, min: null, max: null, currency: "BYN" } },
  ];
  const plan = planBackfill(rows, states());
  assert.deepEqual(plan.map((item) => [item.id, item.action, item.proposed.mode, item.proposed.min, item.proposed.max]), [["a", "UPDATE", "FREE", 0, 0], ["o", "UPDATE", "FROM", 30, null], ["p", "UPDATE", "NONE", null, null]]);
});

test("protects conflicts and is idempotent for canonical targets", () => {
  const row = [{ entity: "Activity" as const, id: "a", classification: "RECOVERABLE" as const, proposed: { mode: "EXACT" as const, min: 10, max: 10, currency: "BYN" } }];
  assert.equal(planBackfill(row, states("EXACT"))[0].action, "CONFLICT");
  const canonical = states("EXACT"); canonical.Activity[0].priceFrom = 10; canonical.Activity[0].priceTo = 10;
  assert.equal(planBackfill(row, canonical)[0].action, "SKIP");
});
