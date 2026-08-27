import { addDaysLocal } from "@/lib/date/localDateKey";
import type { SendNotificationResult } from "@/lib/notifications/domainContracts";
import { getTimeZoneDateKey } from "@/lib/notifications/userNotificationSchedule";
import type { PlanTomorrowDigestCandidate } from "@/server/services/plan.service";

export type DuePlanEveningSchedule = {
  userId: string;
  timeZone: string;
  planEveningNextRunAt: Date;
};

export type RunPlanTomorrowDigestsArgs = { now?: Date; limit?: number };

type Deps = {
  listDueSchedulesFn: (args: { now: Date; limit?: number }) => Promise<DuePlanEveningSchedule[]>;
  listPlanItemsForUserDatesFn: (targets: Array<{ userId: string; date: string }>) => Promise<PlanTomorrowDigestCandidate[]>;
  advanceScheduleFn: (userId: string, now: Date) => Promise<void>;
  sendNotificationFn: (input: {
    scenario: "PLAN_TOMORROW_DIGEST";
    userId: string;
    context: {
      digestDate: string;
      planItemIds: string[];
      timeZone: string;
      items: Array<{
        planItemId: string;
        activityId?: string | null;
        eventTitle: string;
        startsAt?: Date | null;
        placeName?: string | null;
        cityName?: string | null;
      }>;
    };
  }) => Promise<SendNotificationResult>;
};

export type RunPlanTomorrowDigestsResult = {
  schedulesDue: number;
  usersProcessed: number;
  messagesSent: number;
  planItemsIncluded: number;
  skippedEmptyPlan: number;
  skippedDuplicate: number;
  errors: Array<{ userId: string; message: string }>;
};

function resolvePlaceName(candidate: PlanTomorrowDigestCandidate): string | null {
  return candidate.activity?.place?.customAddress || candidate.activity?.place?.shortAddress ||
    candidate.activity?.place?.formattedAddr || candidate.activity?.venue?.addressLine ||
    candidate.activity?.venue?.place?.customAddress || candidate.activity?.venue?.place?.shortAddress ||
    candidate.activity?.venue?.place?.formattedAddr || null;
}

function resolveCityName(candidate: PlanTomorrowDigestCandidate): string | null {
  return candidate.activity?.place?.city?.name || candidate.activity?.venue?.place?.city?.name || null;
}

export async function runPlanTomorrowDigestsCore(
  args: RunPlanTomorrowDigestsArgs,
  deps: Deps,
): Promise<RunPlanTomorrowDigestsResult> {
  const now = args.now ?? new Date();
  const schedules = await deps.listDueSchedulesFn({ now, limit: args.limit });
  const targets = schedules.map((schedule) => ({
    userId: schedule.userId,
    date: addDaysLocal(getTimeZoneDateKey(now, schedule.timeZone), 1),
  }));
  const allItems = await deps.listPlanItemsForUserDatesFn(targets);
  const itemsByUser = new Map<string, PlanTomorrowDigestCandidate[]>();
  for (const item of allItems) {
    const bucket = itemsByUser.get(item.userId) ?? [];
    bucket.push(item);
    itemsByUser.set(item.userId, bucket);
  }

  let messagesSent = 0;
  let planItemsIncluded = 0;
  let skippedEmptyPlan = 0;
  let skippedDuplicate = 0;
  const errors: RunPlanTomorrowDigestsResult["errors"] = [];

  for (const [index, schedule] of schedules.entries()) {
    const target = targets[index]!;
    const items = (itemsByUser.get(schedule.userId) ?? []).slice().sort((a, b) =>
      (a.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
    );
    let shouldAdvance = false;
    try {
      if (items.length === 0) {
        skippedEmptyPlan += 1;
        shouldAdvance = true;
      } else {
        const result = await deps.sendNotificationFn({
          scenario: "PLAN_TOMORROW_DIGEST",
          userId: schedule.userId,
          context: {
            digestDate: target.date,
            timeZone: schedule.timeZone,
            planItemIds: items.map((item) => item.id),
            items: items.map((item) => ({
              planItemId: item.id,
              activityId: item.activityId,
              eventTitle: item.activity?.title ?? item.title ?? "Активность",
              startsAt: item.startsAt,
              placeName: resolvePlaceName(item),
              cityName: resolveCityName(item),
            })),
          },
        });
        if (result.status === "SKIPPED") skippedDuplicate += 1;
        else {
          messagesSent += 1;
          planItemsIncluded += items.length;
        }
        shouldAdvance = true;
      }
    } catch (error) {
      errors.push({ userId: schedule.userId, message: error instanceof Error ? error.message : "PLAN_TOMORROW_DIGEST_FAILED" });
    } finally {
      if (!shouldAdvance) continue;
      try {
        await deps.advanceScheduleFn(schedule.userId, now);
      } catch (error) {
        errors.push({ userId: schedule.userId, message: error instanceof Error ? error.message : "SCHEDULE_ADVANCE_FAILED" });
      }
    }
  }

  return { schedulesDue: schedules.length, usersProcessed: schedules.length, messagesSent, planItemsIncluded, skippedEmptyPlan, skippedDuplicate, errors };
}
