import "server-only";

import { getEffectiveNotificationChannelsForType } from "@/server/services/notificationSettings.service";
import { runPlanTomorrowDigestsCore, type RunPlanTomorrowDigestsArgs, type RunPlanTomorrowDigestsResult } from "./run-plan-tomorrow-digests-core";
import { listPlanItemsForTomorrowDigest } from "@/server/services/plan.service";
import { sendNotification } from "@/server/notifications/notification.service";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";

export async function runPlanTomorrowDigests(
  args: RunPlanTomorrowDigestsArgs = {},
): Promise<RunPlanTomorrowDigestsResult> {
  console.info("[notifications:job] plan tomorrow digest started", {
    nowIso: (args.now ?? new Date()).toISOString(),
  });

  const result = await runPlanTomorrowDigestsCore(args, {
    listPlanItemsForTomorrowDigestFn: listPlanItemsForTomorrowDigest,
    getTelegramConnectionFn: getActiveTelegramConnectionForCurrentEnvironment,
    getChannelPreferencesFn: async (userId) =>
      getEffectiveNotificationChannelsForType({
        userId,
        notificationType: "PLAN_TOMORROW_DIGEST",
      }),
    sendNotificationFn: sendNotification,
  });

  console.info("[notifications:job] plan tomorrow digest finished", {
    targetDate: result.targetDate,
    usersProcessed: result.usersProcessed,
    messagesSent: result.messagesSent,
    planItemsIncluded: result.planItemsIncluded,
    skippedNoTelegram: result.skippedNoTelegram,
    skippedTelegramDisabled: result.skippedTelegramDisabled,
    skippedDuplicate: result.skippedDuplicate,
    errors: result.errors.length,
  });

  if (result.errors.length > 0) {
    console.error("[notifications:job] plan tomorrow digest errors", result.errors);
  }

  return result;
}

async function main() {
  const result = await runPlanTomorrowDigests();
  console.info("[notifications:job] plan tomorrow digest result", JSON.stringify(result, null, 2));
}

if (process.argv[1]?.includes("run-plan-tomorrow-digests.ts")) {
  main().catch((error) => {
    console.error("[notifications:job] plan tomorrow digest failed", error);
    process.exit(1);
  });
}
