import assert from "node:assert/strict";
import test from "node:test";
import { countEventSessionsByDay } from "./eventDensity";

test("density omits empty days and counts each intersecting session day", () => {
  const result: Record<string, number> = countEventSessionsByDay([
    { startsAt: new Date("2026-08-29T09:00:00+03:00") },
    { startsAt: new Date("2026-08-29T15:00:00+03:00") },
    { startsAt: new Date("2026-08-30T09:00:00+03:00") },
  ]);
  assert.deepEqual(result, { "2026-08-29": 2, "2026-08-30": 1 });
  assert.equal(Object.hasOwn(result, "2026-08-31"), false);
});
