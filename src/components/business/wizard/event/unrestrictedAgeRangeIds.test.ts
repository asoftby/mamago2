import assert from "node:assert/strict";
import { getUnrestrictedEventAgeRangeIds } from "./unrestrictedAgeRangeIds";

const ids = getUnrestrictedEventAgeRangeIds();
assert.deepEqual(ids, [
  "0-1",
  "1-3",
  "3-5",
  "5-7",
  "7-9",
  "9-12",
  "12-14",
  "14-16",
  "16-18",
  "18+",
]);
assert.equal(ids.includes("adult-only"), false);
assert.deepEqual(
  getUnrestrictedEventAgeRangeIds([{ value: "3-5" }, { value: "0-1" }]),
  ["0-1", "3-5"],
);

console.log("unrestrictedAgeRangeIds: PASS");
