import assert from "node:assert/strict";

import { extractScheduleDatesAndStartTime, materializeEventScheduleSessions } from "./materializeScheduleSessions";

function testSingleDate() {
  const result = materializeEventScheduleSessions({ mode: "ONE_TIME", dates: ["2026-08-15"] });
  assert.equal(result.materializedSessionCount, 1);
  assert.deepEqual(result.materializedDates, ["2026-08-15"]);
  assert.equal(result.rawRangeCount, 0);
  assert.equal(result.boundaryDateCount, 1);
  assert.equal(result.firstSessionDate, "2026-08-15");
  assert.equal(result.lastSessionDate, "2026-08-15");
}

function testSingleDayInclusiveRange() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-08-15", "2026-08-15"],
    scheduleItems: [{ date: "2026-08-15", dateEnd: "2026-08-15" }],
  });
  assert.equal(result.materializedSessionCount, 1);
  assert.deepEqual(result.materializedDates, ["2026-08-15"]);
  assert.equal(result.rawRangeCount, 1);
}

function testMultiDayRange() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-08-01", "2026-08-05"],
    scheduleItems: [{ date: "2026-08-01", dateEnd: "2026-08-05" }],
  });
  assert.equal(result.materializedSessionCount, 5);
  assert.deepEqual(result.materializedDates, [
    "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05",
  ]);
  assert.equal(result.rawRangeCount, 1);
  assert.equal(result.boundaryDateCount, 2, "boundary dates are just the [start, end] markers, never the session count");
}

function testMultipleNonOverlappingRanges() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-07-01", "2026-07-03", "2026-08-01", "2026-08-03"],
    scheduleItems: [
      { date: "2026-07-01", dateEnd: "2026-07-03" },
      { date: "2026-08-01", dateEnd: "2026-08-03" },
    ],
  });
  assert.equal(result.materializedSessionCount, 6);
  assert.equal(result.rawRangeCount, 2);
  assert.equal(result.boundaryDateCount, 4);
}

function testAdjacentRanges() {
  // 07-01..07-03 and 07-04..07-06 are back-to-back with no gap — every day
  // must appear exactly once, never doubled at the shared boundary.
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-07-01", "2026-07-03", "2026-07-04", "2026-07-06"],
    scheduleItems: [
      { date: "2026-07-01", dateEnd: "2026-07-03" },
      { date: "2026-07-04", dateEnd: "2026-07-06" },
    ],
  });
  assert.equal(result.materializedSessionCount, 6);
  assert.deepEqual(result.materializedDates, [
    "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06",
  ]);
}

/** Overlapping ranges dedup exactly like the real commit does — `expandScheduleItemDates` dedupes via `Set` before this function ever sees the result, so no double-counted `ActivitySession` for a day covered by two ranges. */
function testOverlappingRangesDedup() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-07-01", "2026-07-05", "2026-07-03", "2026-07-08"],
    scheduleItems: [
      { date: "2026-07-01", dateEnd: "2026-07-05" },
      { date: "2026-07-03", dateEnd: "2026-07-08" },
    ],
  });
  assert.equal(result.materializedSessionCount, 8, "07-01..07-08 inclusive, each day counted exactly once despite the 07-03..07-05 overlap");
  assert.deepEqual(result.materializedDates, [
    "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04",
    "2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08",
  ]);
}

/**
 * Past-session pruning happens upstream in `normalizeEvent()` (via
 * `pruneEventScheduleToEligibleSessions`), before a `scheduleDraft` ever
 * reaches this function — this test simulates that already-pruned shape
 * (a range whose dropped-past portion is simply absent) and confirms
 * materialization is faithful to whatever draft it's handed, without
 * re-implementing or fighting pruning.
 */
function testAlreadyPrunedScheduleMaterializesFaithfully() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-08-01", "2026-08-05"],
    scheduleItems: [{ date: "2026-08-01", dateEnd: "2026-08-05" }],
  });
  assert.equal(result.materializedSessionCount, 5);
  assert.equal(result.firstSessionDate, "2026-08-01");
}

/**
 * Active-range start clamping (see `pruneEventScheduleToEligibleSessions`)
 * also happens upstream — this simulates the clamped shape (a range whose
 * original past start was already replaced with today's local date) and
 * confirms the clamped start is honored, not re-derived here.
 */
function testActiveRangeClampedScheduleMaterializesFaithfully() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-07-19", "2026-07-22"],
    scheduleItems: [{ date: "2026-07-19", dateEnd: "2026-07-22" }],
  });
  assert.equal(result.materializedSessionCount, 4);
  assert.equal(result.firstSessionDate, "2026-07-19");
  assert.equal(result.lastSessionDate, "2026-07-22");
}

/**
 * Pure string-based date-key arithmetic (`addDaysLocal`/`expandScheduleItemDates`)
 * — never epoch-millis/UTC-offset math — so a range crossing a month
 * boundary (where a naive UTC-offset shift could skip or repeat a day)
 * still produces the exact consecutive calendar dates with no drift.
 */
function testMonthBoundaryNoDateDrift() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-01-30", "2026-02-02"],
    scheduleItems: [{ date: "2026-01-30", dateEnd: "2026-02-02" }],
  });
  assert.deepEqual(result.materializedDates, ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  assert.equal(result.materializedSessionCount, 4);
}

/** Regression fixture for wordpress-db:events:60404 — real observed shape (3 twelve-day camp shifts). */
function testRegression_60404_ThreeCampShifts() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-07-20", "2026-07-31", "2026-08-01", "2026-08-12", "2026-08-13", "2026-08-24"],
    scheduleItems: [
      { date: "2026-07-20", dateEnd: "2026-07-31" },
      { date: "2026-08-01", dateEnd: "2026-08-12" },
      { date: "2026-08-13", dateEnd: "2026-08-24" },
    ],
    startTime: "12:00",
  });

  assert.equal(result.rawRangeCount, 3, "3 raw ranges");
  assert.equal(result.boundaryDateCount, 6, "6 boundary dates — this is what the preview bug reported as the session count");
  assert.equal(result.materializedSessionCount, 36, "12 + 12 + 12 = 36 materialized daily sessions");
  assert.equal(result.firstSessionDate, "2026-07-20");
  assert.equal(result.lastSessionDate, "2026-08-24");

  // Every day 07-20..08-24 present, no gaps.
  const expected: string[] = [];
  for (let d = new Date(2026, 6, 20); d <= new Date(2026, 7, 24); d.setDate(d.getDate() + 1)) {
    expected.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  assert.deepEqual([...result.materializedDates], expected);
}

// ---------------------------------------------------------------------------
// rawRangeCount must count actual ranges (a valid dateEnd present), never
// scheduleItems.length verbatim — buildScheduleDraft() in normalizeEvent.ts
// emits a scheduleItems entry for every single-date event too, just without
// a dateEnd, and that must not be reported as "1 range" (P2 review finding).
// ---------------------------------------------------------------------------

function testSingleDateScheduleItemWithoutDateEndIsNotARange() {
  const result = materializeEventScheduleSessions({
    mode: "ONE_TIME",
    dates: ["2026-08-01"],
    scheduleItems: [{ date: "2026-08-01" }],
  });
  assert.equal(result.rawRangeCount, 0, "a scheduleItems entry with no dateEnd is a single date, not a range");
  assert.equal(result.materializedSessionCount, 1);
}

function testSingleDateScheduleItemWithDateEndEqualToDateIsARange() {
  const result = materializeEventScheduleSessions({
    mode: "ONE_TIME",
    dates: ["2026-08-01"],
    scheduleItems: [{ date: "2026-08-01", dateEnd: "2026-08-01" }],
  });
  assert.equal(result.rawRangeCount, 1, "an explicit one-day range still counts as a range");
  assert.equal(result.materializedSessionCount, 1);
}

function testInvalidDateEndDoesNotCountAsARange() {
  const result = materializeEventScheduleSessions({
    mode: "ONE_TIME",
    dates: ["2026-08-01"],
    scheduleItems: [{ date: "2026-08-01", dateEnd: "not-a-date" }],
  });
  assert.equal(result.rawRangeCount, 0, "a malformed dateEnd is not a valid range end");
  assert.equal(result.materializedSessionCount, 1);
}

function testMultipleSingleDateItemsAreNotRanges() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-08-01", "2026-08-05", "2026-08-10"],
    scheduleItems: [
      { date: "2026-08-01" },
      { date: "2026-08-05" },
      { date: "2026-08-10" },
    ],
  });
  assert.equal(result.rawRangeCount, 0);
  assert.equal(result.materializedSessionCount, 3);
  assert.deepEqual(result.materializedDates, ["2026-08-01", "2026-08-05", "2026-08-10"]);
}

function testMixedSingleDateAndRealRangeCountsOnlyTheRange() {
  const result = materializeEventScheduleSessions({
    mode: "MULTI_DATE",
    dates: ["2026-08-01", "2026-08-10", "2026-08-14"],
    scheduleItems: [
      { date: "2026-08-01" },
      { date: "2026-08-10", dateEnd: "2026-08-14" },
    ],
  });
  assert.equal(result.rawRangeCount, 1, "only the second item is a real range");
  assert.equal(result.materializedSessionCount, 6, "1 single date + 5-day range (08-10..08-14)");
}

function testNullScheduleDraftYieldsZero() {
  const result = materializeEventScheduleSessions(null);
  assert.equal(result.materializedSessionCount, 0);
  assert.deepEqual(result.materializedDates, []);
  assert.equal(result.firstSessionDate, null);
  assert.equal(result.lastSessionDate, null);
}

/** Pure function, zero I/O — no Prisma/DB client in its signature, so calling it during preview can never create a session ID or write anything. */
function testPureNoSideEffects() {
  const scheduleJson = { mode: "MULTI_DATE" as const, dates: ["2026-08-15"] };
  const first = materializeEventScheduleSessions(scheduleJson);
  const second = materializeEventScheduleSessions(scheduleJson);
  assert.deepEqual(first, second, "same input always produces the same output — no hidden state, no clock, no I/O");
}

/** `extractScheduleDatesAndStartTime` — the underlying helper re-exported for `syncEventActivitySessions.ts` — matches the write path's own startTime precedence. */
function testExtractScheduleDatesAndStartTimeUsesFirstScheduleItemStartTime() {
  const { dates, startTime } = extractScheduleDatesAndStartTime({
    dates: [],
    startTime: "10:00",
    scheduleItems: [{ date: "2026-08-01", dateEnd: "2026-08-02", startTime: "16:00" }],
  });
  assert.deepEqual(dates, ["2026-08-01", "2026-08-02"]);
  assert.equal(startTime, "16:00");
}

function main() {
  testSingleDate();
  testSingleDayInclusiveRange();
  testMultiDayRange();
  testMultipleNonOverlappingRanges();
  testAdjacentRanges();
  testOverlappingRangesDedup();
  testAlreadyPrunedScheduleMaterializesFaithfully();
  testActiveRangeClampedScheduleMaterializesFaithfully();
  testMonthBoundaryNoDateDrift();
  testRegression_60404_ThreeCampShifts();
  testSingleDateScheduleItemWithoutDateEndIsNotARange();
  testSingleDateScheduleItemWithDateEndEqualToDateIsARange();
  testInvalidDateEndDoesNotCountAsARange();
  testMultipleSingleDateItemsAreNotRanges();
  testMixedSingleDateAndRealRangeCountsOnlyTheRange();
  testNullScheduleDraftYieldsZero();
  testPureNoSideEffects();
  testExtractScheduleDatesAndStartTimeUsesFirstScheduleItemStartTime();
  console.log("materializeScheduleSessions tests: OK");
}

main();
