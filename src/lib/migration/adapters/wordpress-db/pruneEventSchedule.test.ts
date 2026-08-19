import assert from "node:assert/strict";

import { expandScheduleItemDates } from "@/lib/event/expandScheduleItemDates";

import { localDateKeyInTimeZone, pruneEventScheduleToEligibleSessions } from "./pruneEventSchedule";
import type { NormalizedEventScheduleDraft } from "./normalizeEvent";

const MIGRATION_NOW = new Date("2026-07-18T00:00:00+03:00");

function draft(overrides: Partial<NormalizedEventScheduleDraft> = {}): NormalizedEventScheduleDraft {
  return {
    mode: "ONE_TIME",
    dates: [],
    ...overrides,
  };
}

function testLocalDateKeyUsesMinskByDefault() {
  // 2026-07-18T00:00:00+03:00 is 2026-07-17T21:00:00Z — a naive UTC-day read would say "17".
  assert.equal(localDateKeyInTimeZone(MIGRATION_NOW), "2026-07-18");
}

function testAllFutureRetainsEverything() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-07-19", "2026-08-01"],
      scheduleItems: [{ date: "2026-07-19" }, { date: "2026-08-01" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.scheduleDraft.dates, ["2026-07-19", "2026-08-01"]);
  assert.deepEqual(result.droppedPastDates, []);
}

function testAllPastExcludesEntirely() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2025-12-13", "2026-03-14"],
      scheduleItems: [{ date: "2025-12-13" }, { date: "2026-03-14" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.droppedPastDates, ["2025-12-13", "2026-03-14"]);
}

function testMixedPastFuturePrunesAndKeepsFuture() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-03-28", "2026-05-30", "2026-07-19"],
      scheduleItems: [{ date: "2026-03-28" }, { date: "2026-05-30" }, { date: "2026-07-19" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.scheduleDraft.dates, ["2026-07-19"]);
  assert.equal(result.scheduleDraft.mode, "ONE_TIME");
  assert.deepEqual(result.droppedPastDates, ["2026-03-28", "2026-05-30"]);
}

function testTodayCountsAsActiveNotPast() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-07-10", "2026-07-18"],
      scheduleItems: [{ date: "2026-07-10" }, { date: "2026-07-18" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.scheduleDraft.dates, ["2026-07-18"]);
}

function testDateRangeUnderwayCountsAsActive() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "ONE_TIME",
      dates: ["2026-07-15", "2026-07-20"],
      scheduleItems: [{ date: "2026-07-15", dateEnd: "2026-07-20" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  // The range is retained (underway, not past) but its start is clamped to
  // today — the original past start (2026-07-15) must never survive into
  // the writer's day-by-day expansion.
  assert.deepEqual(result.scheduleDraft.dates, ["2026-07-18", "2026-07-20"]);
  assert.deepEqual(result.clampedActiveRanges, [
    { originalStartDate: "2026-07-15", clampedStartDate: "2026-07-18", endDate: "2026-07-20", droppedPastDayCount: 3 },
  ]);
}

function testDateRangeFullyPastIsDropped() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "ONE_TIME",
      dates: ["2026-06-01", "2026-06-05"],
      scheduleItems: [{ date: "2026-06-01", dateEnd: "2026-06-05" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.droppedPastDates, ["2026-06-01"]);
}

function testDuplicateSessionsDeduped() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-07-19"],
      scheduleItems: [
        { date: "2026-07-19", startTime: "10:00" },
        { date: "2026-07-19", startTime: "10:00" },
      ],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.scheduleDraft.scheduleItems?.length, 1);
}

function testResultSortedAscending() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-08-01", "2026-07-19"],
      scheduleItems: [{ date: "2026-08-01" }, { date: "2026-07-19" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(
    result.scheduleDraft.scheduleItems?.map((item) => item.date),
    ["2026-07-19", "2026-08-01"],
  );
}

function testFirstRetainedStartTimeCarriedOver() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-03-28", "2026-07-19"],
      scheduleItems: [{ date: "2026-03-28", startTime: "09:00" }, { date: "2026-07-19", startTime: "18:30" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.scheduleDraft.startTime, "18:30");
}

function testActiveRangeCrossingTodayClampsStart() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "ONE_TIME",
      dates: ["2026-06-01", "2026-08-21"],
      scheduleItems: [{ date: "2026-06-01", dateEnd: "2026-08-21", startTime: "08:30" }],
      startTime: "08:30",
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.scheduleDraft.scheduleItems, [
    { date: "2026-07-18", dateEnd: "2026-08-21", startTime: "08:30" },
  ]);
  assert.deepEqual(result.scheduleDraft.dates, ["2026-07-18", "2026-08-21"]);
  assert.deepEqual(result.clampedActiveRanges, [
    { originalStartDate: "2026-06-01", clampedStartDate: "2026-07-18", endDate: "2026-08-21", droppedPastDayCount: 47 },
  ]);
}

function testActiveRangeExpansionNeverProducesPastDates() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "ONE_TIME",
      dates: ["2026-06-01", "2026-08-21"],
      scheduleItems: [{ date: "2026-06-01", dateEnd: "2026-08-21", startTime: "08:30" }],
      startTime: "08:30",
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  const expanded = expandScheduleItemDates(result.scheduleDraft.scheduleItems as { date: string; dateEnd?: string }[]);
  assert.equal(expanded.length, 35);
  assert.equal(expanded[0], "2026-07-18");
  assert.equal(expanded[expanded.length - 1], "2026-08-21");
  assert.ok(expanded.every((d) => d >= "2026-07-18"), "no expanded date may be before today");
}

function testFutureRangeUnchangedByClamping() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "ONE_TIME",
      dates: ["2026-08-01", "2026-08-10"],
      scheduleItems: [{ date: "2026-08-01", dateEnd: "2026-08-10" }],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.scheduleDraft.scheduleItems, [{ date: "2026-08-01", dateEnd: "2026-08-10" }]);
  assert.deepEqual(result.clampedActiveRanges, []);
}

function testRangeEndingTodayClampsToSingleDate() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "ONE_TIME",
      dates: ["2026-07-01", "2026-07-18"],
      scheduleItems: [{ date: "2026-07-01", dateEnd: "2026-07-18", startTime: "09:00" }],
      startTime: "09:00",
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.scheduleDraft.scheduleItems, [{ date: "2026-07-18", startTime: "09:00" }]);
  const expanded = expandScheduleItemDates(result.scheduleDraft.scheduleItems as { date: string; dateEnd?: string }[]);
  assert.deepEqual(expanded, ["2026-07-18"]);
}

function testMixedItemsPastDroppedActiveClampedFutureKept() {
  const result = pruneEventScheduleToEligibleSessions({
    scheduleDraft: draft({
      mode: "MULTI_DATE",
      dates: ["2026-06-01", "2026-06-10", "2026-07-01", "2026-07-25", "2026-09-01"],
      scheduleItems: [
        { date: "2026-06-01", dateEnd: "2026-06-10" }, // fully past -> dropped
        { date: "2026-07-01", dateEnd: "2026-07-25" }, // underway -> clamped
        { date: "2026-09-01" }, // future -> kept as-is
      ],
    }),
    now: MIGRATION_NOW,
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.deepEqual(result.droppedPastDates, ["2026-06-01"]);
  assert.deepEqual(result.clampedActiveRanges, [
    { originalStartDate: "2026-07-01", clampedStartDate: "2026-07-18", endDate: "2026-07-25", droppedPastDayCount: 17 },
  ]);
  assert.deepEqual(result.scheduleDraft.scheduleItems, [
    { date: "2026-07-18", dateEnd: "2026-07-25" },
    { date: "2026-09-01" },
  ]);
  assert.deepEqual(result.scheduleDraft.dates, ["2026-07-18", "2026-07-25", "2026-09-01"]);
}

function main() {
  testLocalDateKeyUsesMinskByDefault();
  testAllFutureRetainsEverything();
  testAllPastExcludesEntirely();
  testMixedPastFuturePrunesAndKeepsFuture();
  testTodayCountsAsActiveNotPast();
  testDateRangeUnderwayCountsAsActive();
  testDateRangeFullyPastIsDropped();
  testDuplicateSessionsDeduped();
  testResultSortedAscending();
  testFirstRetainedStartTimeCarriedOver();
  testActiveRangeCrossingTodayClampsStart();
  testActiveRangeExpansionNeverProducesPastDates();
  testFutureRangeUnchangedByClamping();
  testRangeEndingTodayClampsToSingleDate();
  testMixedItemsPastDroppedActiveClampedFutureKept();
}

main();
console.log("pruneEventSchedule tests: OK");
