import type { PrismaClient } from "@prisma/client";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";
import { extractScheduleOccurrences } from "@/lib/event/materializeScheduleSessions";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

type EventActivitySessionsPrisma = {
  activitySession: Pick<
    PrismaClient["activitySession"],
    "createMany" | "deleteMany" | "findMany"
  >;
};

/**
 * Fingerprint of the exact ActivitySession occurrences driven by scheduleJson.
 * Recurrence and per-schedule-item times are already expanded by the canonical
 * materializer, so PATCH guards cannot silently treat a changed recurrence as
 * equivalent to the old base dates.
 */
export function eventSessionScheduleFingerprint(scheduleJson: unknown): string {
  const occurrences = extractScheduleOccurrences(scheduleJson);
  return stableJsonStringify({ occurrences });
}

/**
 * Fingerprint ActivitySession instants as venue-local date+time occurrences.
 * The persisted Date is an absolute UTC instant; the schedule contract is a
 * Europe/Minsk wall clock, so ambient server timezone must never participate.
 */
export function eventSessionFingerprintFromStoredSessions(
  sessions: { startsAt: Date }[],
): string {
  const occurrences = sessions
    .map((session) => ({
      date: getLocalDateKey(session.startsAt),
      startTime: formatHHMM(session.startsAt),
    }))
    .sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
    );

  return stableJsonStringify({ occurrences });
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
 * Replaces ActivitySession rows from wizard scheduleJson.
 *
 * Every materialized occurrence carries its own date and start time. This is
 * required for recurring schedules and for multiple schedule blocks with
 * different times. Venue-local wall-clock values are converted explicitly to
 * UTC; ambient server timezone never participates.
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
  const occurrences = extractScheduleOccurrences(scheduleJson);

  const deleteStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  await prisma.activitySession.deleteMany({ where: { activityId } });
  const deleteMs = isServerSavePerfEnabled() ? Math.round(performance.now() - deleteStarted) : 0;

  if (occurrences.length === 0) {
    if (isServerSavePerfEnabled()) {
      console.info("[event-sessions-sync]", {
        activityId,
        sessionsCount: 0,
        deleteMs,
        createMs: 0,
        totalMs: Math.round(performance.now() - started),
      });
    }
    return 0;
  }

  const startsAtList = occurrences.map((occurrence) =>
    localWallClockToUtc(occurrence.date, occurrence.startTime),
  );

  const createStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  await prisma.activitySession.createMany({
    data: startsAtList.map((startsAt) => ({ activityId, startsAt })),
  });
  const createMs = isServerSavePerfEnabled() ? Math.round(performance.now() - createStarted) : 0;

  if (isServerSavePerfEnabled()) {
    console.info("[event-sessions-sync]", {
      activityId,
      sessionsCount: startsAtList.length,
      deleteMs,
      createMs,
      totalMs: Math.round(performance.now() - started),
    });
  }

  return startsAtList.length;
}
