import assert from "node:assert/strict";
import { getCrossRegionFamilyThreshold, DEFAULT_CROSS_REGION_FAMILY_THRESHOLD } from "./crossRegionThreshold";

assert.equal(DEFAULT_CROSS_REGION_FAMILY_THRESHOLD, 50);
assert.equal(getCrossRegionFamilyThreshold("minskaya-oblast", undefined), 50);
assert.equal(getCrossRegionFamilyThreshold("brestskaya-oblast", '{"brestskaya-oblast":75}'), 75);
assert.equal(getCrossRegionFamilyThreshold("minskaya-oblast", '{"brestskaya-oblast":75}'), 50);
for (const value of ["0", "-1", "1.5", '"50"', "null", "1000001"]) {
  assert.equal(getCrossRegionFamilyThreshold("minskaya-oblast", '{"minskaya-oblast":'+value+'}'), 50);
}
assert.equal(getCrossRegionFamilyThreshold("minskaya-oblast", "not-json"), 50);
assert.equal(getCrossRegionFamilyThreshold(null, '{"minskaya-oblast":75}'), 50);
assert.equal(getCrossRegionFamilyThreshold("minskaya-oblast", '{"minskaya-oblast":49}'), 49);
console.log("cross-region threshold configuration: OK");
