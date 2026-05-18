import { addDaysLocal } from "@/lib/date/localDateKey";
import type {
  NotificationChannelPreferenceMatrix,
  SendNotificationResult,
} from "@/lib/notifications/domainContracts";
import type { PlanTomorrowDigestCandidate } from "@/server/services/plan.service";

const MINSK_TIME_ZONE = "Europe/Minsk";
const DEFAULT_CITY_SLUG = "minsk";

export type RunPlanTomorrowDigestsArgs = {
  now?: Date;
};

type RunPlanTomorrowDigestsDeps = {
  listPlanItemsForTomorrowDigestFn: (args: {
    date: string;
  }) => Promise<PlanTomorrowDigestCandidate[]>;
  getTelegramConnectionFn: (
    userId: string,
  ) => Promise<{ isActive?: boolean; telegramChatId?: string | null } | null>;
  getChannelPreferencesFn: (
    userId: string,
  ) => Promise<NotificationChannelPreferenceMatrix>;
  sendNotificationFn: (input: {
    scenario: "PLAN_TOMORROW_DIGEST";
    userId: string;
    context: {
      digestDate: string;
      citySlug?: string | null;
      planItemIds: string[];
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
  targetDate: string;
  usersProcessed: number;
  messagesSent: number;
  planItemsIncluded: number;
  skippedNoTelegram: number;
  skippedTelegramDisabled: number;
  skippedDuplicate: number;
  errors: Array<{ userId: string; message: string }>;
};

function getTimeZoneDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

function resolvePlaceName(candidate: PlanTomorrowDigestCandidate): string | null {
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

function resolveCityName(candidate: PlanTomorrowDigestCandidate): string | null {
  return (
    candidate.activity?.place?.city?.name ||
    candidate.activity?.venue?.place?.city?.name ||
    null
  );
}

function resolveCitySlug(): string {
  return DEFAULT_CITY_SLUG;
}

function resolveEventTitle(candidate: PlanTomorrowDigestCandidate): string {
  return candidate.activity?.title ?? candidate.title ?? "Активность";
}

function groupCandidatesByUser(
  candidates: PlanTomorrowDigestCandidate[],
): Map<string, PlanTomorrowDigestCandidate[]> {
  return candidates.reduce((accumulator, candidate) => {
    const bucket = accumulator.get(candidate.userId) ?? [];
    bucket.push(candidate);
    accumulator.set(candidate.userId, bucket);
    return accumulator;
  }, new Map<string, PlanTomorrowDigestCandidate[]>());
}

export async function runPlanTomorrowDigestsCore(
  args: RunPlanTomorrowDigestsArgs,
  deps: RunPlanTomorrowDigestsDeps,
): Promise<RunPlanTomorrowDigestsResult> {
  const now = args.now ?? new Date();
  const todayKey = getTimeZoneDateKey(now, MINSK_TIME_ZONE);
  const targetDate = addDaysLocal(todayKey, 1);
  const candidates = await deps.listPlanItemsForTomorrowDigestFn({
    date: targetDate,
  });
  const candidatesByUser = groupCandidatesByUser(candidates);

  let messagesSent = 0;
  let planItemsIncluded = 0;
  let skippedNoTelegram = 0;
  let skippedTelegramDisabled = 0;
  let skippedDuplicate = 0;
  const errors: RunPlanTomorrowDigestsResult["errors"] = [];

  for (const [userId, userCandidates] of candidatesByUser.entries()) {
    const connection = await deps.getTelegramConnectionFn(userId);
    const hasTelegram =
      connection?.isActive === true && Boolean(connection.telegramChatId);

    if (!hasTelegram) {
      skippedNoTelegram += 1;
      continue;
    }

    const preferences = await deps.getChannelPreferencesFn(userId);
    if (!preferences.TELEGRAM) {
      skippedTelegramDisabled += 1;
      continue;
    }

    const sortedCandidates = userCandidates.slice().sort((left, right) => {
      const leftTs = left.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTs = right.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTs - rightTs;
    });

    const citySlug = resolveCitySlug();

    try {
      const result = await deps.sendNotificationFn({
        scenario: "PLAN_TOMORROW_DIGEST",
        userId,
        context: {
          digestDate: targetDate,
          citySlug,
          planItemIds: sortedCandidates.map((candidate) => candidate.id),
          items: sortedCandidates.map((candidate) => ({
            planItemId: candidate.id,
            activityId: candidate.activityId,
            eventTitle: resolveEventTitle(candidate),
            startsAt: candidate.startsAt,
            placeName: resolvePlaceName(candidate),
            cityName: resolveCityName(candidate),
          })),
        },
      });

      if (result.status === "SKIPPED") {
        skippedDuplicate += 1;
        continue;
      }

      const telegramDelivery = result.deliveries.find(
        (delivery) => delivery.channel === "TELEGRAM",
      );

      if (telegramDelivery?.status === "SENT") {
        messagesSent += 1;
        planItemsIncluded += sortedCandidates.length;
        continue;
      }

      if (telegramDelivery?.status === "FAILED") {
        errors.push({
          userId,
          message: telegramDelivery.errorMessage ?? "TELEGRAM_SEND_FAILED",
        });
        continue;
      }

      if (telegramDelivery?.status === "SKIPPED") {
        skippedNoTelegram += 1;
      }
    } catch (error) {
      errors.push({
        userId,
        message:
          error instanceof Error ? error.message : "PLAN_TOMORROW_DIGEST_FAILED",
      });
    }
  }

  return {
    targetDate,
    usersProcessed: candidatesByUser.size,
    messagesSent,
    planItemsIncluded,
    skippedNoTelegram,
    skippedTelegramDisabled,
    skippedDuplicate,
    errors,
  };
}
