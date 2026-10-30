import type { NotificationScenario, PlanEventReminderContext } from "@/lib/notifications/domainContracts";

/** Plan-row identity plus due instant: separate saved rows and re-schedules get separate reminders. */
export function buildPlanReminderEventId(context: Pick<PlanEventReminderContext, "planItemId" | "startsAt" | "reminderDueAt">): string {
  return `${context.planItemId}:${(context.reminderDueAt ?? context.startsAt).toISOString()}`;
}

export function buildNotificationDedupeKeyCore(args: {
  scenario: NotificationScenario;
  userId: string;
  eventId: string;
}): string {
  switch (args.scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return `PLAN_EVENT_2H_BEFORE:${args.userId}:${args.eventId}`;
    case "PLAN_TOMORROW_DIGEST":
      return `PLAN_TOMORROW_DIGEST:${args.userId}:${args.eventId}`;
    default: {
      const exhaustiveCheck: never = args.scenario;
      return exhaustiveCheck;
    }
  }
}
