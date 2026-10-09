import assert from "node:assert/strict";
import { buildPlanDayMarkers, buildScopedPlanDayMarkers } from "./planDayMarkers";

assert.deepEqual(
  buildPlanDayMarkers([
    { date: "2026-10-08", childId: null },
    { date: "2026-10-08", childId: null },
    { date: "2026-10-08", childId: "c1" },
    { date: "2026-10-09", childId: "c2" },
  ]),
  { "2026-10-08": ["family", "c1"], "2026-10-09": ["c2"] },
);
assert.deepEqual(buildPlanDayMarkers([]), {});
console.log("planDayMarkers.test.ts ok");

const scoped = [
  { date: "2026-10-08", childId: null, visibility: "PRIVATE" as const, authorId: "me" },
  { date: "2026-10-09", childId: "child-1", visibility: "FAMILY" as const, authorId: "other" },
  { date: "2026-10-10", childId: null, visibility: "PRIVATE" as const, authorId: "other" },
];
assert.deepEqual(buildScopedPlanDayMarkers(scoped, "all", "me"), {
  "2026-10-08": ["family"],
  "2026-10-09": ["child-1"],
  "2026-10-10": ["family"],
});
assert.deepEqual(buildScopedPlanDayMarkers(scoped, "family", "me"), {
  "2026-10-09": ["child-1"],
});
assert.deepEqual(buildScopedPlanDayMarkers(scoped, "mine", "me"), {
  "2026-10-08": ["family"],
});
