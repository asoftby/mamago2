import type { PrismaClient } from "@prisma/client";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";
import { extractScheduleDatesAndStartTime } from "@/lib/event/materializeScheduleSessions";

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

/** Fingerprint of ActivitySession rows for comparison with {@link eventSessionScheduleFingerprint}. */
export function eventSessionFingerprintFromStoredSessions(
  sessions: { startsAt: Date }[],
): string {
  if (sessions.length === 0) {
    return stableJsonStringify({ dates: [], startTime: "10:00" });
  }
  const dates: string[] = [];
  for (const s of sessions) {
    const d = s.startsAt;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  const sortedDates = [...new Set(dates)].sort();
  const first = sessions[0].startsAt;
  const hh = String(first.getHours()).padStart(2, "0");
  const mm = String(first.getMinutes()).padStart(2, "0");
  const startTime = `${hh}:${mm}`;
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

  const startsAtList: Date[] = [];
  for (const dateStr of dates) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    startsAtList.push(new Date(y, m - 1, d, hh, mm, 0, 0));
  }

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
