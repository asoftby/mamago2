import assert from "node:assert/strict";
import test from "node:test";
import { buildPriceDistribution } from "./priceDistribution";

test("builds real buckets including free and handles edge cases", () => {
  assert.deepEqual(buildPriceDistribution([]), { max: null, step: null, buckets: [] });
  const single = buildPriceDistribution([30]);
  assert.equal(single.buckets.reduce((sum, bucket) => sum + bucket.count, 0), 1);
  const mixed = buildPriceDistribution([0, 30, 30, 120]);
  assert.equal(mixed.max, 125);
  assert.equal(mixed.buckets.reduce((sum, bucket) => sum + bucket.count, 0), 4);
  assert.equal(mixed.buckets[0]?.count, 3);
  assert.ok((mixed.buckets[0]?.from ?? 1) <= 0);
  assert.ok((mixed.buckets[0]?.to ?? 0) > 0);
});
