import assert from "node:assert/strict";
import type { PlanItemWithActivity } from "../types/event";
import { sortPlanItemsForDay } from "./sortPlanItemsForDay";

function item(
  id: string,
  startsAt: Date | null,
  title = `Item ${id}`,
  createdAt = new Date("2026-08-01"),
): PlanItemWithActivity {
  return {
    id,
    userId: "user",
    activityId: id,
    date: "2026-09-01",
    startsAt,
    title,
    coverImageUrl: null,
    createdAt,
    activity: null,
  };
}

// Timed items sort chronologically.
{
  const result = sortPlanItemsForDay([
    item("late", new Date("2026-09-01T14:00:00Z")),
    item("early", new Date("2026-09-01T09:00:00Z")),
  ]);
  assert.deepEqual(result.map((i) => i.id), ["early", "late"]);
}

// Timed items always come before untimed items ("Без времени" items sort last).
{
  const result = sortPlanItemsForDay([
    item("untimed", null),
    item("timed", new Date("2026-09-01T09:00:00Z")),
  ]);
  assert.deepEqual(result.map((i) => i.id), ["timed", "untimed"]);
}

// Multiple untimed items fall back to title, then createdAt — but never gain a fabricated time.
{
  const result = sortPlanItemsForDay([
    item("b", null, "Б Активность"),
    item("a", null, "А Активность"),
  ]);
  assert.deepEqual(result.map((i) => i.id), ["a", "b"]);
  assert.equal(result[0]!.startsAt, null);
  assert.equal(result[1]!.startsAt, null);
}

console.log("sortPlanItemsForDay tests: OK");
