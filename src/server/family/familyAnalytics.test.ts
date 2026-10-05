import assert from "node:assert/strict";
import { mergeYoungestBirthDates, planCountUnit } from "./familyAnalyticsPure";

const d = (s: string) => new Date(s);
const merged = mergeYoungestBirthDates(
  new Map([["a", d("2020-01-01")], ["b", d("2019-01-01")]]),
  new Map([["a", d("2022-01-01")], ["b", d("2018-01-01")], ["c", d("2021-01-01")]]),
);
assert.equal(merged.get("a")?.toISOString(), d("2022-01-01").toISOString());
assert.equal(merged.get("b")?.toISOString(), d("2019-01-01").toISOString());
assert.equal(merged.get("c")?.toISOString(), d("2021-01-01").toISOString());
assert.equal(planCountUnit({ familyId: "F", userId: "u1" }), planCountUnit({ familyId: "F", userId: "u2" }));
assert.notEqual(planCountUnit({ familyId: null, userId: "u1" }), planCountUnit({ familyId: null, userId: "u2" }));
console.log("familyAnalytics.test: ok");
