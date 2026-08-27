import "server-only";

import { sendNotification } from "@/server/notifications/notification.service";
import { listPlanItemsForUserDates } from "@/server/services/plan.service";
import { advancePlanEveningSchedule, listDuePlanEveningSchedules } from "@/server/services/userNotificationSchedule.service";
import { runPlanTomorrowDigestsCore, type RunPlanTomorrowDigestsArgs, type RunPlanTomorrowDigestsResult } from "./run-plan-tomorrow-digests-core";

export async function runPlanTomorrowDigests(args: RunPlanTomorrowDigestsArgs = {}): Promise<RunPlanTomorrowDigestsResult> {
  return runPlanTomorrowDigestsCore(args, {
    listDueSchedulesFn: listDuePlanEveningSchedules,
    listPlanItemsForUserDatesFn: listPlanItemsForUserDates,
    advanceScheduleFn: advancePlanEveningSchedule,
    sendNotificationFn: sendNotification,
  });
}

async function main() {
  const result = await runPlanTomorrowDigests();
  console.info("[notifications:job] plan tomorrow digest", JSON.stringify(result, null, 2));
}

if (process.argv[1]?.includes("run-plan-tomorrow-digests.ts")) {
  main().catch((error) => {
    console.error("[notifications:job] plan tomorrow digest failed", error);
    process.exit(1);
  });
}
