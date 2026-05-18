import type { NotificationType } from "@prisma/client";
import type { NotificationScenario } from "@/lib/notifications/domainContracts";

export function resolveNotificationTypeForScenario(
  scenario: NotificationScenario,
): NotificationType {
  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return "REMINDER";
    case "PLAN_TOMORROW_DIGEST":
      return "PLAN_TOMORROW_DIGEST";
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}
