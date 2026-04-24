import type { SendNotificationResult } from "@/lib/notifications/domainContracts";
import type { PlanReminderCandidate } from "@/server/services/plan.service";

const DEFAULT_LOOKAHEAD_MINUTES = 120;
const DEFAULT_WINDOW_BEFORE_MINUTES = 10;
const DEFAULT_WINDOW_AFTER_MINUTES = 10;

export type RunPlanEventRemindersArgs = {
  now?: Date;
  lookaheadMinutes?: number;
  windowBeforeMinutes?: number;
  windowAfterMinutes?: number;
};

type RunPlanEventRemindersDeps = {
  listPlanItemsDueForReminderFn: (args: {
    windowStart: Date;
    windowEnd: Date;
  }) => Promise<PlanReminderCandidate[]>;
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
    };
  }) => Promise<SendNotificationResult>;
};

export type RunPlanEventRemindersResult = {
  nowIso: string;
  windowStartIso: string;
  windowEndIso: string;
  candidatesFound: number;
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{
    planItemId: string;
    userId: string;
    activityId: string | null;
    eventTitle: string;
    startsAt: string | null;
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
  const lookaheadMinutes = args.lookaheadMinutes ?? DEFAULT_LOOKAHEAD_MINUTES;
  const windowBeforeMinutes = args.windowBeforeMinutes ?? DEFAULT_WINDOW_BEFORE_MINUTES;
  const windowAfterMinutes = args.windowAfterMinutes ?? DEFAULT_WINDOW_AFTER_MINUTES;

  const target = addMinutes(now, lookaheadMinutes);
  const windowStart = addMinutes(target, -windowBeforeMinutes);
  const windowEnd = addMinutes(target, windowAfterMinutes);

  const candidates = await deps.listPlanItemsDueForReminderFn({
    windowStart,
    windowEnd,
  });

  const results: RunPlanEventRemindersResult["results"] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result = await deps.sendNotificationFn({
        scenario: "PLAN_EVENT_2H_BEFORE",
        userId: candidate.userId,
        context: {
          planItemId: candidate.id,
          activityId: candidate.activityId,
          eventTitle: candidate.activity?.title ?? candidate.title ?? "Событие",
          startsAt: candidate.startsAt ?? windowStart,
          placeName: resolvePlaceName(candidate),
          cityName: resolveCityName(candidate),
        },
      });

      if (result.status === "SENT") sent += 1;
      if (result.status === "SKIPPED") skipped += 1;

      results.push({
        planItemId: candidate.id,
        userId: candidate.userId,
        activityId: candidate.activityId,
        eventTitle: candidate.activity?.title ?? candidate.title ?? "Событие",
        startsAt: candidate.startsAt?.toISOString() ?? null,
        result,
      });
    } catch (error) {
      failed += 1;
      results.push({
        planItemId: candidate.id,
        userId: candidate.userId,
        activityId: candidate.activityId,
        eventTitle: candidate.activity?.title ?? candidate.title ?? "Событие",
        startsAt: candidate.startsAt?.toISOString() ?? null,
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
    sent,
    skipped,
    failed,
    results,
  };
}
