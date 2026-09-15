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
 * ActivitySession with a non-null `source` (import-created, e.g. ABWS —
 * see ABWS_PARSER_KEY) *at the time of this initial read*. scheduleJson has
 * no representation for source/externalId/buyUrl/price, so replacing
 * sessions here would silently discard them — the defect fixed piecemeal at
 * individual call sites in PR #298 and PR #302 (BACKLOG-153), and now
 * enforced once, here, so every current and future caller is protected by
 * construction instead of each one having to remember its own pre-call
 * check (BACKLOG-154). Safe for every known caller: the event wizard route
 * (PR #298) and WordPress-migration resync/create paths (which never set
 * `source` on their own sessions, so this never fires for their legitimate
 * resyncs) are unaffected; the previously-unguarded ops scripts
 * (resync-event-sessions-from-schedule-json.ts,
 * migration-event-sessions-resync.ts) are now protected too.
 *
 * The read above and the delete below are NOT wrapped in a serializable
 * transaction — a concurrent ABWS upsert landing an imported session
 * between them is possible (found by automated review on PR #303). Rather
 * than requiring every caller to run this inside a serializable
 * transaction, the delete itself is scoped to `source: null` so it can
 * never remove an imported row regardless of timing — the race can at
 * worst leave a freshly-landed imported session next to newly created bare
 * sessions (a mixed state to clean up), never delete import data.
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
    select: { source: true },
  });
  const hasImportedSessions = existingSessions.some((s) => s.source != null);
  if (hasImportedSessions) {
    console.info("[event-sessions-sync] skipped — activity has imported sessions", {
      activityId,
      existingSessionsCount: existingSessions.length,
    });
    return { count: 0, skipped: true };
  }

  const occurrences = extractScheduleOccurrences(scheduleJson);

  const deleteStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  // Scoped to source: null — see function doc. Never deletes an imported
  // row, even one that lands after the read above.
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

  return { count: startsAtList.length, skipped: false };
}
