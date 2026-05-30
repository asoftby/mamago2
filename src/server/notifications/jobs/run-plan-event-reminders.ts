import "server-only";

import { sendNotification } from "@/server/notifications/notification.service";
import { listPlanItemsDueForReminder } from "@/server/services/plan.service";
import { getEffectiveNotificationPolicyForScenario } from "@/server/services/notificationPolicy.service";
import {
  runPlanEventRemindersCore,
  type RunPlanEventRemindersArgs,
  type RunPlanEventRemindersResult,
} from "./run-plan-event-reminders-core";

export async function runPlanEventReminders(
  args: RunPlanEventRemindersArgs = {},
): Promise<RunPlanEventRemindersResult> {
  const policy = await getEffectiveNotificationPolicyForScenario("PLAN_EVENT_2H_BEFORE");
  const lookaheadMinutes =
    args.lookaheadMinutes ??
    (policy?.defaultReminderOffsetMinutes && policy.defaultReminderOffsetMinutes > 0
      ? policy.defaultReminderOffsetMinutes
      : undefined);

  return runPlanEventRemindersCore({ ...args, lookaheadMinutes }, {
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
