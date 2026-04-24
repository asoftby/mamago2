import "server-only";

import { sendNotification } from "@/server/notifications/notification.service";
import { listPlanItemsDueForReminder } from "@/server/services/plan.service";
import {
  runPlanEventRemindersCore,
  type RunPlanEventRemindersArgs,
  type RunPlanEventRemindersResult,
} from "./run-plan-event-reminders-core";

export async function runPlanEventReminders(
  args: RunPlanEventRemindersArgs = {},
): Promise<RunPlanEventRemindersResult> {
  return runPlanEventRemindersCore(args, {
    listPlanItemsDueForReminderFn: listPlanItemsDueForReminder,
    sendNotificationFn: sendNotification,
  });
}

async function main() {
  const result = await runPlanEventReminders();
  console.info("[notifications:job] plan event reminders", JSON.stringify(result, null, 2));
}

if (process.argv[1]?.includes("run-plan-event-reminders.ts")) {
  main().catch((error) => {
    console.error("[notifications:job] failed", error);
    process.exit(1);
  });
}
