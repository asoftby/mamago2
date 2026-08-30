import assert from "node:assert/strict";

import { AGE_OPTIONS } from "@/lib/config/ages";
import { canonicalizeAgeTags, isPlaceAgeChipActive } from "./isPlaceAgeChipActive";

const ALL_KEYS = AGE_OPTIONS.map((o) => o.key);

function testEmptyStoredTagsLeavesSpecificChipsInactive() {
  for (const key of ALL_KEYS) {
    assert.equal(
      isPlaceAgeChipActive({ storedAgeTags: [], chipAgeTag: key }),
      false,
      `expected "${key}" to stay inactive when "Любой возраст" is selected`,
    );
  }
}

function testSpecificStoredTagsOnlyActivateThemselves() {
  assert.equal(isPlaceAgeChipActive({ storedAgeTags: ["3-5"], chipAgeTag: "3-5" }), true);
  assert.equal(isPlaceAgeChipActive({ storedAgeTags: ["3-5"], chipAgeTag: "5-7" }), false);
  assert.equal(isPlaceAgeChipActive({ storedAgeTags: ["3-5"], chipAgeTag: "0-1" }), false);
}

function testCanonicalizeCollapsesFullSelectionToEmpty() {
  const result = canonicalizeAgeTags(ALL_KEYS);
  assert.deepEqual(result, []);
}

function testCanonicalizeLeavesPartialSelectionUntouched() {
  const result = canonicalizeAgeTags(["3-5", "5-7"]);
  assert.deepEqual(result, ["3-5", "5-7"]);
}

function testCanonicalizeLeavesEmptyAsEmpty() {
  assert.deepEqual(canonicalizeAgeTags([]), []);
}

function testCanonicalizeIgnoresUnknownTagsWhenCheckingCompleteness() {
  const result = canonicalizeAgeTags([...ALL_KEYS, "not-a-real-age"]);
  assert.deepEqual(result, [...ALL_KEYS, "not-a-real-age"]);
}

function main() {
  testEmptyStoredTagsLeavesSpecificChipsInactive();
  testSpecificStoredTagsOnlyActivateThemselves();
  testCanonicalizeCollapsesFullSelectionToEmpty();
  testCanonicalizeLeavesPartialSelectionUntouched();
  testCanonicalizeLeavesEmptyAsEmpty();
  testCanonicalizeIgnoresUnknownTagsWhenCheckingCompleteness();
}

main();
console.log("isPlaceAgeChipActive tests: OK");
