import assert from "node:assert/strict";
import { buildUpcomingPlaceEventsWhere } from "./loadUpcomingPlaceEvents";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  OK ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

test("matches a place by both activity.placeId and venue.placeId", () => {
  const where = buildUpcomingPlaceEventsWhere({
    placeId: "place-123",
    cityId: "city-456",
    now: new Date("2026-06-11T12:00:00.000Z"),
  });

  const andParts = Array.isArray(where.AND) ? where.AND : [];
  const placeRelation = andParts.find(
    (part) => typeof part === "object" && part != null && "OR" in part,
  ) as { OR?: unknown } | undefined;

  assert.deepEqual(placeRelation?.OR, [
    { placeId: "place-123" },
    { venue: { placeId: "place-123" } },
  ]);
});

test("preserves public upcoming visibility filters with session fallback", () => {
  const where = buildUpcomingPlaceEventsWhere({
    placeId: "place-123",
    now: new Date("2026-06-11T12:00:00.000Z"),
  });

  const json = JSON.stringify(where);
  assert.match(json, /"nextOccurrenceAt"/);
  assert.match(json, /"sessions"/);
  assert.match(json, /"status"/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
