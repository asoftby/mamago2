import assert from "node:assert/strict";
import { normalizeMyPlanProfileChildren } from "./normalizeProfileChildren";

assert.doesNotThrow(() =>
  normalizeMyPlanProfileChildren([
    { id: "a", name: null, birthDate: "2020-05-01", systemInterests: [] },
    { id: "b", name: "", birthDate: "2021-06-15", systemInterests: [{ interestSlug: "art" }] },
  ]),
);
assert.deepEqual(
  normalizeMyPlanProfileChildren([
    { id: "a", name: null, birthDate: "2020-05-01" },
    { id: "b", name: "", birthDate: "2021-06-15" },
  ]).map((child) => child.name),
  ["Ребёнок 1", "Ребёнок 2"],
);

console.log("normalizeProfileChildren.test.ts: OK");
