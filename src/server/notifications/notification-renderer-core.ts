import type {
  NotificationScenario,
  RenderedNotificationContent,
  SendNotificationContext,
} from "@/lib/notifications/domainContracts";

const MINSK_TIME_ZONE = "Europe/Minsk";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MINSK_TIME_ZONE,
  }).format(date);
}

function formatDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: MINSK_TIME_ZONE,
  });

  return formatter.format(date);
}

function renderPlanEvent2hBefore(
  context: SendNotificationContext,
): RenderedNotificationContent {
  const startsAtLabel = formatTime(context.startsAt);
  const ctaUrl = `/me/day/${formatDateKey(context.startsAt)}`;

  return {
    title: "Скоро событие",
    body: `В ${startsAtLabel} у вас в плане: ${context.eventTitle}`,
    ctaLabel: "Открыть план",
    ctaUrl,
  };
}

export function renderNotificationContentCore(
  scenario: NotificationScenario,
  context: SendNotificationContext,
): RenderedNotificationContent {
  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return renderPlanEvent2hBefore(context);
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}
