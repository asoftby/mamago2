import type { PrismaClient } from "@prisma/client";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";
import { extractScheduleDatesAndStartTime } from "@/lib/event/materializeScheduleSessions";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

type EventActivitySessionsPrisma = {
  activitySession: Pick<
    PrismaClient["activitySession"],
    "createMany" | "deleteMany" | "findMany"
  >;
};

/**
 * Fingerprint of schedule fields that drive ActivitySession rows (dates + time).
 * Ignores organizer, pricing, etc. so PATCH can update JSON without deleteMany/createMany sessions.
 */
export function eventSessionScheduleFingerprint(scheduleJson: unknown): string {
  const { dates, startTime } = extractScheduleDatesAndStartTime(scheduleJson);
  const sortedDates = [...new Set(dates)].sort();
  return stableJsonStringify({ dates: sortedDates, startTime });
}

/**
 * Fingerprint ActivitySession instants as venue-local calendar/time values.
 * The persisted Date is an absolute UTC instant; the schedule contract is a
 * Europe/Minsk wall clock, so ambient server timezone must never participate.
 */
export function eventSessionFingerprintFromStoredSessions(
  sessions: { startsAt: Date }[],
): string {
  if (sessions.length === 0) {
    return stableJsonStringify({ dates: [], startTime: "10:00" });
  }

  const sortedSessions = [...sessions].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  const dates = sortedSessions.map((session) => getLocalDateKey(session.startsAt));
  const sortedDates = [...new Set(dates)].sort();
  const startTime = formatHHMM(sortedSessions[0].startsAt);

  return stableJsonStringify({ dates: sortedDates, startTime });
}

export async function activitySessionsMatchScheduleJson(
  input: {
    prisma: EventActivitySessionsPrisma;
    activityId: string;
    scheduleJson: unknown;
  },
): Promise<boolean> {
  const { prisma, activityId, scheduleJson } = input;
  const fromJson = eventSessionScheduleFingerprint(scheduleJson);
  const rows = await prisma.activitySession.findMany({
    where: { activityId },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });
  return fromJson === eventSessionFingerprintFromStoredSessions(rows);
}

/**
 * Replaces ActivitySession rows from wizard scheduleJson (dates + time).
 * Required for submit validation and listings that rely on sessions.
 *
 * `scheduleJson` stores venue-local wall-clock values. Convert them to the
 * corresponding UTC instant explicitly instead of using `new Date(y, m, d,
 * hh, mm)`, which silently depends on the process timezone (UTC in prod).
 */
export async function replaceActivitySessionsFromScheduleJson(
  input: {
    prisma: EventActivitySessionsPrisma;
    activityId: string;
    scheduleJson: unknown;
  },
): Promise<number> {
  const { prisma, activityId, scheduleJson } = input;
  const started = isServerSavePerfEnabled() ? performance.now() : 0;
  const { dates, startTime } = extractScheduleDatesAndStartTime(scheduleJson);

  const deleteStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  await prisma.activitySession.deleteMany({ where: { activityId } });
  const deleteMs = isServerSavePerfEnabled() ? Math.round(performance.now() - deleteStarted) : 0;

  if (dates.length === 0) {
    if (isServerSavePerfEnabled()) {
      console.info("[event-sessions-sync]", {
        activityId,
        datesCount: 0,
        startTime,
        deleteMs,
        createMs: 0,
        totalMs: Math.round(performance.now() - started),
      });
    }
    return 0;
  }

  const startsAtList = dates.map((dateStr) =>
    localWallClockToUtc(dateStr, startTime),
  );

  const createStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  await prisma.activitySession.createMany({
    data: startsAtList.map((startsAt) => ({ activityId, startsAt })),
  });
  const createMs = isServerSavePerfEnabled() ? Math.round(performance.now() - createStarted) : 0;

  if (isServerSavePerfEnabled()) {
    console.info("[event-sessions-sync]", {
      activityId,
      datesCount: startsAtList.length,
      startTime,
      deleteMs,
      createMs,
      totalMs: Math.round(performance.now() - started),
    });
  }

  return startsAtList.length;
}
