import assert from "node:assert/strict";
import test from "node:test";
import { seasonallyCurrentJournalWhere } from "./seasonalJournal";

test("evergreen articles stay eligible even without active occasions", () => {
  const where = seasonallyCurrentJournalWhere([]);
  const alternatives = where.OR as Record<string, unknown>[];
  assert.deepEqual(alternatives[0], { occasionId: null });
  assert.equal(alternatives.some((item) => "seasonReviewedForStart" in item), false);
});

test("only approved active occasion season enters recommended journal feeds", () => {
  const start = new Date("2026-10-01T00:00:00Z");
  const where = seasonallyCurrentJournalWhere([{ id: "halloween", startsAt: start }]);
  assert.deepEqual((where.OR as Record<string, unknown>[]).at(-1), {
    occasionId: "halloween",
    seasonReviewedForStart: start,
  });
});

test("a new startsAt needs editorial review for the new season", () => {
  const oldStart = new Date("2026-10-01T00:00:00Z");
  const nextStart = new Date("2027-10-01T00:00:00Z");
  const previous = seasonallyCurrentJournalWhere([{ id: "halloween", startsAt: oldStart }]);
  const next = seasonallyCurrentJournalWhere([{ id: "halloween", startsAt: nextStart }]);
  assert.notDeepEqual((previous.OR as unknown[]).at(-1), (next.OR as unknown[]).at(-1));
});

test("occasions without active dates are not stamped as a current season", () => {
  const where = seasonallyCurrentJournalWhere([{ id: "undated", startsAt: null }]);
  assert.equal((where.OR as unknown[]).length, 3);
});
