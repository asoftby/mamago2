import assert from "node:assert/strict";
import { resolveIdeaPlanState } from "./ideaPlanStatus";

const today = "2026-10-03";

// Dated behavior is unchanged.
assert.deepEqual(resolveIdeaPlanState([], today), { planStatus: "UNPLANNED", isPlanned: false });
assert.deepEqual(resolveIdeaPlanState([{ id: "a", date: "2026-10-05" }], today), {
  planStatus: "PLANNED_UPCOMING",
  isPlanned: true,
  plannedDate: "2026-10-05",
  planItemId: "a",
});
assert.deepEqual(resolveIdeaPlanState([{ id: "p", date: "2026-10-01" }], today), {
  planStatus: "PLANNED_PAST",
  isPlanned: false,
  plannedDate: "2026-10-01",
  planItemId: "p",
});

// An undated plan item still means "in plan", without a date.
assert.deepEqual(resolveIdeaPlanState([{ id: "u", date: null }], today), {
  planStatus: "PLANNED_UPCOMING",
  isPlanned: true,
  planItemId: "u",
});

// A dated upcoming item wins over an undated one; undated wins over past.
assert.equal(
  resolveIdeaPlanState([{ id: "u", date: null }, { id: "a", date: "2026-10-05" }], today).planItemId,
  "a",
);
assert.deepEqual(
  resolveIdeaPlanState([{ id: "p", date: "2026-10-01" }, { id: "u", date: null }], today),
  { planStatus: "PLANNED_UPCOMING", isPlanned: true, planItemId: "u" },
);

console.log("ideaPlanStatus.test.ts: OK");
