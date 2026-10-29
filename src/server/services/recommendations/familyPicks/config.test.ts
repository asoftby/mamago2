import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAMILY_PICKS_CONFIG, normalizeFamilyPicksConfig } from "./config";

test("default weights match the owner decision and sum to 100", () => {
  const w = DEFAULT_FAMILY_PICKS_CONFIG.weights;
  assert.deepEqual(w, { age: 25, interests: 25, date: 30, territory: 10, history: 10, budget: 0 });
  assert.equal(w.age + w.interests + w.date + w.territory + w.history + w.budget, 100);
});

test("normalize clamps and falls back on garbage", () => {
  const c = normalizeFamilyPicksConfig({ weights: { age: -5, date: "x", budget: 500 }, resultCount: 99, minResultCount: 50 });
  assert.equal(c.weights.age, 0);
  assert.equal(c.weights.date, 30);
  assert.equal(c.weights.budget, 100);
  assert.equal(c.resultCount, 12);
  assert.equal(c.minResultCount, 12);
  assert.deepEqual(normalizeFamilyPicksConfig(null), DEFAULT_FAMILY_PICKS_CONFIG);
});
