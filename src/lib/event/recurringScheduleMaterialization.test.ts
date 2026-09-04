import assert from "node:assert/strict";

import {
  extractScheduleOccurrences,
  materializeEventScheduleSessions,
} from "./materializeScheduleSessions";
import {
  eventSessionFingerprintFromStoredSessions,
  eventSessionScheduleFingerprint,
  replaceActivitySessionsFromScheduleJson,
} from "@/lib/business/syncEventActivitySessions";
import { localWallClockToUtc } from "@/lib/date/localDateKey";

const NEBOREKA_SCHEDULE = {
  scheduleItems: [
    {
      date: "2026-09-02",
      dateEnd: "2026-09-04",
      startTime: "14:00",
      recurringEnabled: true,
      recurrenceInterval: 1,
      recurrenceUnit: "week",
      recurrenceUntil: "2026-11-08",
    },
    {
      date: "2026-08-29",
      dateEnd: "2026-08-30",
      startTime: "12:00",
      recurringEnabled: true,
      recurrenceInterval: 1,
      recurrenceUnit: "week",
      recurrenceUntil: "2026-11-08",
    },
  ],
};

function testNeborekaWeeklyRangesExpandThroughUntil() {
  const occurrences = extractScheduleOccurrences(NEBOREKA_SCHEDULE);
  assert.equal(occurrences.length, 52, "two weekly recurring ranges must materialize all occurrences through 8 Nov");

  const futureFromSep4 = occurrences.filter((occurrence) => occurrence.date >= "2026-09-04");
  assert.equal(futureFromSep4.length, 48, "from 4 Sep the public page should have 48 available sessions, not one");
  assert.deepEqual(futureFromSep4.slice(0, 6), [
    { date: "2026-09-04", startTime: "14:00" },
    { date: "2026-09-05", startTime: "12:00" },
    { date: "2026-09-06", startTime: "12:00" },
    { date: "2026-09-09", startTime: "14:00" },
    { date: "2026-09-10", startTime: "14:00" },
    { date: "2026-09-11", startTime: "14:00" },
  ]);
  assert.deepEqual(futureFromSep4.at(-1), { date: "2026-11-08", startTime: "12:00" });

  const report = materializeEventScheduleSessions(NEBOREKA_SCHEDULE);
  assert.equal(report.materializedSessionCount, 52);
  assert.equal(report.firstSessionDate, "2026-08-29");
  assert.equal(report.lastSessionDate, "2026-11-08");
}

function testDifferentTimesOnSameDateStayDistinct() {
  const occurrences = extractScheduleOccurrences({
    scheduleItems: [
      { date: "2026-09-10", startTime: "12:00" },
      { date: "2026-09-10", startTime: "18:00" },
      { date: "2026-09-10", startTime: "18:00" },
    ],
  });

  assert.deepEqual(occurrences, [
    { date: "2026-09-10", startTime: "12:00" },
    { date: "2026-09-10", startTime: "18:00" },
  ]);
}

function testRecurrenceIntervalIsHonored() {
  const occurrences = extractScheduleOccurrences({
    scheduleItems: [
      {
        date: "2026-09-01",
        startTime: "10:00",
        recurringEnabled: true,
        recurrenceInterval: 2,
        recurrenceUnit: "week",
        recurrenceUntil: "2026-09-30",
      },
    ],
  });

  assert.deepEqual(occurrences, [
    { date: "2026-09-01", startTime: "10:00" },
    { date: "2026-09-15", startTime: "10:00" },
    { date: "2026-09-29", startTime: "10:00" },
  ]);
}

function testMonthlyRecurrenceDoesNotDriftAfterShortMonth() {
  const occurrences = extractScheduleOccurrences({
    scheduleItems: [
      {
        date: "2026-01-31",
        startTime: "10:00",
        recurringEnabled: true,
        recurrenceInterval: 1,
        recurrenceUnit: "month",
        recurrenceUntil: "2026-04-30",
      },
    ],
  });

  assert.deepEqual(occurrences, [
    { date: "2026-01-31", startTime: "10:00" },
    { date: "2026-02-28", startTime: "10:00" },
    { date: "2026-03-31", startTime: "10:00" },
    { date: "2026-04-30", startTime: "10:00" },
  ]);
}

function testScheduleFingerprintIncludesRecurrenceAndPerItemTimes() {
  const occurrences = extractScheduleOccurrences(NEBOREKA_SCHEDULE);
  const stored = occurrences.map((occurrence) => ({
    startsAt: localWallClockToUtc(occurrence.date, occurrence.startTime),
  }));

  assert.equal(
    eventSessionScheduleFingerprint(NEBOREKA_SCHEDULE),
    eventSessionFingerprintFromStoredSessions(stored),
  );
}

async function testWriterPersistsExactOccurrences() {
  const created: Array<{ activityId: string; startsAt: Date }> = [];
  let deleted = false;

  const prisma = {
    activitySession: {
      deleteMany: async () => {
        deleted = true;
        return { count: 0 };
      },
      createMany: async (args: { data: Array<{ activityId: string; startsAt: Date }> }) => {
        created.push(...args.data);
        return { count: args.data.length };
      },
      findMany: async () => created.map(({ startsAt }) => ({ startsAt })),
    },
  };

  const count = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-neboreka",
    scheduleJson: NEBOREKA_SCHEDULE,
  });

  assert.equal(deleted, true);
  assert.equal(count, 52);
  assert.equal(created.length, 52);
  assert.equal(created[0]?.startsAt.toISOString(), "2026-08-29T09:00:00.000Z");
  assert.equal(created.at(-1)?.startsAt.toISOString(), "2026-11-08T09:00:00.000Z");
}

async function main() {
  testNeborekaWeeklyRangesExpandThroughUntil();
  testDifferentTimesOnSameDateStayDistinct();
  testRecurrenceIntervalIsHonored();
  testMonthlyRecurrenceDoesNotDriftAfterShortMonth();
  testScheduleFingerprintIncludesRecurrenceAndPerItemTimes();
  await testWriterPersistsExactOccurrences();
  console.log("recurringScheduleMaterialization tests: OK");
}

void main();
