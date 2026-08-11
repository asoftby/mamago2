import assert from "node:assert/strict";
import { detectScenarioConflictIds } from "./detectScenarioConflicts";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 1, hour, minute);
}

// No items / single item — nothing to conflict with.
assert.deepEqual([...detectScenarioConflictIds([])], []);
assert.deepEqual([...detectScenarioConflictIds([{ id: "a", startsAt: at(10) }])], []);

// Untimed items never conflict — nothing to compare.
assert.deepEqual(
  [...detectScenarioConflictIds([{ id: "a", startsAt: null }, { id: "b", startsAt: null }])],
  [],
  "untimed items produce no conflicts",
);

// Clearly separated timed items — no conflict.
{
  const ids = detectScenarioConflictIds([
    { id: "a", startsAt: at(10) },
    { id: "b", startsAt: at(14) },
  ]);
  assert.equal(ids.size, 0, "10:00 and 14:00 (60min assumed duration) do not overlap");
}

// Obvious overlap (same start time) — both flagged.
{
  const ids = detectScenarioConflictIds([
    { id: "a", startsAt: at(11) },
    { id: "b", startsAt: at(11) },
  ]);
  assert.equal(ids.has("a"), true);
  assert.equal(ids.has("b"), true);
}

// Overlap within the assumed 60-minute window — flagged.
{
  const ids = detectScenarioConflictIds([
    { id: "a", startsAt: at(11, 0) },
    { id: "b", startsAt: at(11, 30) },
  ]);
  assert.equal(ids.has("a"), true);
  assert.equal(ids.has("b"), true, "11:00 + assumed 60min duration overlaps an 11:30 start");
}

// Exactly back-to-back (starts exactly when the previous assumed window ends) — no conflict.
{
  const ids = detectScenarioConflictIds([
    { id: "a", startsAt: at(11, 0) },
    { id: "b", startsAt: at(12, 0) },
  ]);
  assert.equal(ids.size, 0, "back-to-back at the assumed duration boundary is not a conflict");
}

// Mixed timed + untimed — only the timed overlapping pair is flagged.
{
  const ids = detectScenarioConflictIds([
    { id: "a", startsAt: at(11) },
    { id: "b", startsAt: at(11, 15) },
    { id: "c", startsAt: null },
  ]);
  assert.equal(ids.has("a"), true);
  assert.equal(ids.has("b"), true);
  assert.equal(ids.has("c"), false);
}

console.log("detectScenarioConflictIds tests: OK");
