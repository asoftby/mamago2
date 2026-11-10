import type { PrismaClient } from "@prisma/client";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";
import { extractScheduleOccurrences } from "@/lib/event/materializeScheduleSessions";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

type EventActivitySessionsPrisma = {
  activitySession: Pick<
    PrismaClient["activitySession"],
    "createMany" | "deleteMany" | "findMany" | "updateMany"
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
  sessions: { startsAt: Date; title?: string | null; withdrawnAt?: Date | null }[],
): string {
  const occurrences = sessions
    .filter((session) => !session.withdrawnAt)
    .map((session) => ({
      date: getLocalDateKey(session.startsAt),
      startTime: formatHHMM(session.startsAt),
      ...(session.title ? { title: session.title } : {}),
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
    where: { activityId, withdrawnAt: null },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, title: true },
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
 * Keep stable IDs and ticket metadata for unchanged times. Retire removed
 * sessions still referenced by bookings or allocations so existing bookings
 * retain their original session and resource history.

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
    orderBy: [{ withdrawnAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      startsAt: true,
      source: true,
      title: true,
      withdrawnAt: true,
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

  const desired = new Map(extractScheduleOccurrences(scheduleJson).map((occurrence) => {
    const startsAt = localWallClockToUtc(occurrence.date, occurrence.startTime);
    return [startsAt.getTime(), { startsAt, title: occurrence.title ?? null }];
  }));
  const count = desired.size;
  const removedIds: string[] = [];
  const updates = new Map<string | null, string[]>();
  for (const session of existingSessions) {
    const instant = session.startsAt.getTime();
    const target = desired.get(instant);
    if (!target) {
      if (!session.withdrawnAt) removedIds.push(session.id);
      continue;
    }
    desired.delete(instant);
    if (session.title !== target.title || session.withdrawnAt) {
      const ids = updates.get(target.title) ?? [];
      ids.push(session.id);
      updates.set(target.title, ids);
    }
  }
  const deleteStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  if (removedIds.length) {
    const where = { activityId, source: null, id: { in: removedIds } };
    await prisma.activitySession.deleteMany({
      where: { ...where, bookingRequests: { none: {} }, allocations: { none: {} } },
    });
    await prisma.activitySession.updateMany({
      where,
      data: { withdrawnAt: new Date() },
    });
  }
  for (const [title, ids] of updates) {
    await prisma.activitySession.updateMany({
      where: { activityId, source: null, id: { in: ids } },
      data: { title, withdrawnAt: null },
    });
  }
  const createStarted = isServerSavePerfEnabled() ? performance.now() : 0;
  if (desired.size) {
    await prisma.activitySession.createMany({
      data: [...desired.values()].map(({ startsAt, title }) => ({
        activityId,
        startsAt,
        ...(title ? { title } : {}),
      })),
    });
  }
  if (isServerSavePerfEnabled()) {
    console.info("[event-sessions-sync]", {
      activityId,
      sessionsCount: count,
      deleteMs: Math.round(createStarted - deleteStarted),
      createMs: Math.round(performance.now() - createStarted),
      totalMs: Math.round(performance.now() - started),
    });
  }
  return { count, skipped: false };
}
