/**
 * Построение плоского payload для шаблонов из контекста сценарного пайплайна.
 * Ключи и форматирование должны соответствовать Zod-схемам сценариев
 * в NOTIFICATION_SCENARIO_REGISTRY (notificationRegistry.ts).
 */

import type {
  NotificationScenario,
  PlanEventReminderContext,
  PlanTomorrowDigestContext,
  SendNotificationContext,
} from "@/lib/notifications/domainContracts";
import {
  buildDigestItemsText,
  formatDateKey,
  formatTime,
} from "./notification-renderer-core";

export function buildScenarioTemplatePayloadCore(
  scenario: NotificationScenario,
  context: SendNotificationContext,
): Record<string, string> {
  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE": {
      const planContext = context as PlanEventReminderContext;
      return {
        eventTitle: planContext.eventTitle,
        startsAtTime: formatTime(planContext.startsAt),
        startsAtDate: formatDateKey(planContext.startsAt),
        ...(planContext.placeName ? { placeName: planContext.placeName } : {}),
        ...(planContext.cityName ? { cityName: planContext.cityName } : {}),
      };
    }
    case "PLAN_TOMORROW_DIGEST": {
      const digestContext = context as PlanTomorrowDigestContext;
      return {
        digestDate: digestContext.digestDate,
        itemsText: buildDigestItemsText(digestContext.items),
      };
    }
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}
