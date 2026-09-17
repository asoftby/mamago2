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
 *
 * Refuses to run at all when the target Activity already has any
 * ActivitySession with a non-null `source` (import-created, e.g. ABWS). An
 * explicit manual-takeover action clears source/externalId first and stores a
 * PREFER_MANUAL override, after which this normal wizard resync is allowed.
 *
 * For source:null rows we preserve ticket metadata when the occurrence instant
 * itself did not change. That makes manual takeover non-destructive: editing a
 * different date does not throw away buyUrl/price/sale-state for untouched
 * sessions. Metadata is deliberately not copied to a changed instant because
 * an imported ticket URL may identify one exact performance.
 *
 * The read and delete are not serializable, but the delete itself is scoped to
 * `source: null`; a concurrent imported row can therefore never be deleted.
 */
export async function replaceActivitySessionsFromScheduleJson(
  input: {
    prisma: EventActivitySessionsPrisma;
    activityId: string;
    scheduleJson: unknown;
  },
): Promise<{ count: number; skipped: boolean }> {
  const { prisma, activityId, scheduleJson } = input;
  const started = isServerSavePerfEnabled() ? performance.now() : 0;

  const existingSessions = await prisma.activitySession.findMany({
    where: { activityId },
    select: {
      startsAt: true,
      source: true,
      buyUrl: true,
      priceMinCents: true,
      priceMaxCents: true,
      isSaleOpen: true,
    },
  });
  const hasImportedSessions = existingSessions.some((s) => s.source != null);
  if (hasImportedSessions) {
    console.info("[event-sessions-sync] skipped — activity has imported sessions", {
      activityId,
      existingSessionsCount: existingSessions.length,
    });
    return { count: 0, skipped: true };
  }

  const metadataByInstant = new Map(
    existingSessions.map((session) => [
      session.startsAt.toISOString(),
      {
        buyUrl: session.buyUrl,
        priceMinCents: session.priceMinCents,
        priceMaxCents: session.priceMaxCents,
        isSaleOpen: session.isSaleOpen,
      },
    ]),
  );

  const occurrences = extractScheduleOccurrences(scheduleJson);

  const deleteStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  // Never delete an imported row, even if one lands concurrently after the
  // read above.
  await prisma.activitySession.deleteMany({ where: { activityId, source: null } });
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
    return { count: 0, skipped: false };
  }

  const startsAtList = occurrences.map((occurrence) =>
    localWallClockToUtc(occurrence.date, occurrence.startTime),
  );

  const createStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  await prisma.activitySession.createMany({
    data: startsAtList.map((startsAt) => ({
      activityId,
      startsAt,
      ...(metadataByInstant.get(startsAt.toISOString()) ?? {}),
    })),
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

  return { count: startsAtList.length, skipped: false };
}
