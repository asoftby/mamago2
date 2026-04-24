import type { NotificationScenario } from "@/lib/notifications/domainContracts";

export function buildNotificationDedupeKeyCore(args: {
  scenario: NotificationScenario;
  userId: string;
  eventId: string;
}): string {
  switch (args.scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return `PLAN_EVENT_2H_BEFORE:${args.userId}:${args.eventId}`;
    default: {
      const exhaustiveCheck: never = args.scenario;
      return exhaustiveCheck;
    }
  }
}
