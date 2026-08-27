import type { SendNotificationResult } from "@/lib/notifications/domainContracts";
import { DEFAULT_NOTIFICATION_TIME_ZONE } from "@/lib/notifications/userNotificationSchedule";
import type { PlanReminderCandidate } from "@/server/services/plan.service";
import type { UserReminderSchedule } from "@/server/services/userNotificationSchedule.service";

const DEFAULT_MAX_OFFSET_MINUTES = 180;
const DEFAULT_DUE_GRACE_MINUTES = 10;

export type RunPlanEventRemindersArgs = {
  now?: Date;
  maxOffsetMinutes?: number;
  dueGraceMinutes?: number;
};

type RunPlanEventRemindersDeps = {
  listPlanItemsDueForReminderFn: (args: {
    windowStart: Date;
    windowEnd: Date;
  }) => Promise<PlanReminderCandidate[]>;
  getReminderSettingsForUsersFn: (
    userIds: string[],
  ) => Promise<Map<string, UserReminderSchedule>>;
  sendNotificationFn: (input: {
    scenario: "PLAN_EVENT_2H_BEFORE";
    userId: string;
    context: {
      planItemId: string;
      activityId: string | null;
      eventTitle: string;
      startsAt: Date;
      placeName?: string | null;
      cityName?: string | null;
      timeZone?: string;
    };
  }) => Promise<SendNotificationResult>;
};

export type RunPlanEventRemindersResult = {
  nowIso: string;
  windowStartIso: string;
  windowEndIso: string;
  candidatesFound: number;
  dueCandidates: number;
  skippedSchedule: number;
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{
    planItemId: string;
    userId: string;
    activityId: string | null;
    eventTitle: string;
    startsAt: string | null;
    offsetMinutes: number;
    result: SendNotificationResult | { status: "FAILED"; errorMessage: string };
  }>;
};

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function resolvePlaceName(candidate: PlanReminderCandidate): string | null {
  return (
    candidate.activity?.place?.customAddress ||
    candidate.activity?.place?.shortAddress ||
    candidate.activity?.place?.formattedAddr ||
    candidate.activity?.venue?.addressLine ||
    candidate.activity?.venue?.place?.customAddress ||
    candidate.activity?.venue?.place?.shortAddress ||
    candidate.activity?.venue?.place?.formattedAddr ||
    null
  );
}

function resolveCityName(candidate: PlanReminderCandidate): string | null {
  return (
    candidate.activity?.place?.city?.name ||
    candidate.activity?.venue?.place?.city?.name ||
    null
  );
}

export async function runPlanEventRemindersCore(
  args: RunPlanEventRemindersArgs,
  deps: RunPlanEventRemindersDeps,
): Promise<RunPlanEventRemindersResult> {
  const now = args.now ?? new Date();
  const maxOffsetMinutes = args.maxOffsetMinutes ?? DEFAULT_MAX_OFFSET_MINUTES;
  const dueGraceMinutes = args.dueGraceMinutes ?? DEFAULT_DUE_GRACE_MINUTES;
  const windowStart = addMinutes(now, -dueGraceMinutes);
  const windowEnd = addMinutes(now, maxOffsetMinutes + dueGraceMinutes);

  const candidates = await deps.listPlanItemsDueForReminderFn({ windowStart, windowEnd });
  const settingsByUser = await deps.getReminderSettingsForUsersFn(
    Array.from(new Set(candidates.map((candidate) => candidate.userId))),
  );

  const results: RunPlanEventRemindersResult["results"] = [];
  let dueCandidates = 0;
  let skippedSchedule = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const settings = settingsByUser.get(candidate.userId) ?? {
      enabled: true,
      offsetMinutes: 120,
      timeZone: DEFAULT_NOTIFICATION_TIME_ZONE,
    };
    const startsAt = candidate.startsAt;
    if (!settings.enabled || !startsAt || startsAt.getTime() <= now.getTime()) {
      skippedSchedule += 1;
      continue;
    }

    const dueAt = addMinutes(startsAt, -settings.offsetMinutes);
    const oldestAllowedDueAt = addMinutes(now, -dueGraceMinutes);
    if (dueAt.getTime() > now.getTime() || dueAt.getTime() < oldestAllowedDueAt.getTime()) {
      skippedSchedule += 1;
      continue;
    }

    dueCandidates += 1;
    try {
      const result = await deps.sendNotificationFn({
        scenario: "PLAN_EVENT_2H_BEFORE",
        userId: candidate.userId,
        context: {
          planItemId: candidate.id,
          activityId: candidate.activityId,
          eventTitle: candidate.activity?.title ?? candidate.title ?? "Событие",
          startsAt,
          placeName: resolvePlaceName(candidate),
          cityName: resolveCityName(candidate),
          timeZone: settings.timeZone,
        },
      });

      if (result.status === "SENT") sent += 1;
      if (result.status === "SKIPPED") skipped += 1;

      results.push({
        planItemId: candidate.id,
        userId: candidate.userId,
        activityId: candidate.activityId,
        eventTitle: candidate.activity?.title ?? candidate.title ?? "Событие",
        startsAt: startsAt.toISOString(),
        offsetMinutes: settings.offsetMinutes,
        result,
      });
    } catch (error) {
      failed += 1;
      results.push({
        planItemId: candidate.id,
        userId: candidate.userId,
        activityId: candidate.activityId,
        eventTitle: candidate.activity?.title ?? candidate.title ?? "Событие",
        startsAt: startsAt.toISOString(),
        offsetMinutes: settings.offsetMinutes,
        result: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "REMINDER_JOB_FAILED",
        },
      });
    }
  }

  return {
    nowIso: now.toISOString(),
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
    candidatesFound: candidates.length,
    dueCandidates,
    skippedSchedule,
    sent,
    skipped,
    failed,
    results,
  };
}
