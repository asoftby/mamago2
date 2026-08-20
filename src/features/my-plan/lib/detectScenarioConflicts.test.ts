import assert from "node:assert/strict";
import { detectScenarioConflicts } from "./detectScenarioConflicts";
import type { ScenarioScheduling, ScenarioSchedulingKind } from "./scenarioScheduling";

function at(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 8, 1, hour, minute));
}

function item(
  id: string,
  kind: ScenarioSchedulingKind,
  start: Date | null,
  end: Date | null,
) {
  const scheduling: ScenarioScheduling = {
    kind,
    startsAt: start,
    endsAt: end,
    durationMinutes: start && end ? (end.getTime() - start.getTime()) / 60_000 : null,
    canReschedule: false,
  };
  return { id, contentId: id.toUpperCase(), scheduling };
}

assert.deepEqual(detectScenarioConflicts([]), []);

// Definition-of-done fixture: 08:00–10:00 overlaps 08:30–09:30.
assert.equal(
  detectScenarioConflicts([
    item("morning-a", "SLOT", at(8), at(10)),
    item("morning-b", "SLOT", at(8, 30), at(9, 30)),
  ]).length,
  1,
);

// SLOT ↔ SLOT overlap.
assert.deepEqual(
  detectScenarioConflicts([
    item("a", "SLOT", at(10), at(12)),
    item("b", "SLOT", at(11), at(13)),
  ]),
  [{ type: "TIME_OVERLAP", key: "TIME_OVERLAP:a@A:b@B", itemIds: ["a", "b"] }],
);

// Touching half-open boundaries do not overlap.
assert.deepEqual(
  detectScenarioConflicts([
    item("a", "SLOT", at(10), at(11)),
    item("b", "SLOT", at(11), at(12)),
  ]),
  [],
);

// WINDOW and UNKNOWN never create hard conflicts.
for (const pair of [
  [item("a", "WINDOW", at(8), at(18)), item("b", "SLOT", at(12), at(13))],
  [item("a", "WINDOW", at(8), at(18)), item("b", "WINDOW", at(12), at(13))],
  [item("a", "UNKNOWN", at(8), at(18)), item("b", "SLOT", at(12), at(13))],
]) {
  assert.deepEqual(detectScenarioConflicts(pair), []);
}

// A SLOT without a proven end is excluded.
assert.deepEqual(
  detectScenarioConflicts([
    item("a", "SLOT", at(10), null),
    item("b", "SLOT", at(10, 30), at(12)),
  ]),
  [],
);

// Key and item order are stable regardless of input order.
const forward = detectScenarioConflicts([
  item("z", "SLOT", at(10), at(12)),
  item("a", "SLOT", at(11), at(13)),
]);
const reverse = detectScenarioConflicts([
  item("a", "SLOT", at(11), at(13)),
  item("z", "SLOT", at(10), at(12)),
]);
assert.deepEqual(forward, reverse);
assert.equal(forward[0]?.key, "TIME_OVERLAP:a@A:z@Z");

// A long interval conflicts with every contained later interval, not only its neighbour.
assert.deepEqual(
  detectScenarioConflicts([
    item("long", "SLOT", at(9), at(18)),
    item("early", "SLOT", at(10), at(11)),
    item("late", "SLOT", at(15), at(16)),
  ]).map((conflict) => conflict.key),
  ["TIME_OVERLAP:early@EARLY:long@LONG", "TIME_OVERLAP:late@LATE:long@LONG"],
);

// Replacing content in the same PlanItem changes the key; undo restores it.
{
  const a = item("a", "SLOT", at(10), at(12));
  const b = item("b", "SLOT", at(11), at(13));
  const originalKey = detectScenarioConflicts([a, b])[0]?.key;
  const replacementKey = detectScenarioConflicts([a, { ...b, contentId: "C" }])[0]?.key;
  const undoKey = detectScenarioConflicts([a, b])[0]?.key;
  assert.notEqual(replacementKey, originalKey);
  assert.equal(undoKey, originalKey);
}

console.log("detectScenarioConflicts tests: OK");
