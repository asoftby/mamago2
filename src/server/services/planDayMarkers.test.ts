import assert from "node:assert/strict";
import { buildPlanDayMarkers } from "./planDayMarkers";

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
