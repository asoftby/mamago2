import type {
  NotificationScenario,
  PlanEventReminderContext,
  PlanTomorrowDigestContext,
  RenderedNotificationContent,
  SendNotificationContext,
} from "@/lib/notifications/domainContracts";
import { DEFAULT_NOTIFICATION_TIME_ZONE } from "@/lib/notifications/userNotificationSchedule";

export function formatTime(
  date: Date,
  timeZone: string = DEFAULT_NOTIFICATION_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function formatDateKey(
  date: Date,
  timeZone: string = DEFAULT_NOTIFICATION_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

function renderPlanEvent2hBefore(
  context: SendNotificationContext,
): RenderedNotificationContent {
  const planContext = context as PlanEventReminderContext;
  const timeZone = planContext.timeZone ?? DEFAULT_NOTIFICATION_TIME_ZONE;
  const startsAtLabel = formatTime(planContext.startsAt, timeZone);
  const ctaUrl = `/me/day/${formatDateKey(planContext.startsAt, timeZone)}`;

  return {
    title: "Скоро событие",
    body: `В ${startsAtLabel} у вас в плане: ${planContext.eventTitle}`,
    ctaLabel: "Открыть план",
    ctaUrl,
  };
}

function renderDigestLine(
  item: PlanTomorrowDigestContext["items"][number],
  timeZone: string,
): string {
  const timeLabel = item.startsAt ? `${formatTime(item.startsAt, timeZone)} — ` : "";
  const titleLine = `${timeLabel}${item.eventTitle}`;
  if (!item.placeName) return titleLine;
  return `${titleLine}\n📍 ${item.placeName}`;
}

/** Готовый текст позиций дайджеста — переиспользуется шаблонным payload-builder'ом. */
export function buildDigestItemsText(
  items: PlanTomorrowDigestContext["items"],
  timeZone: string = DEFAULT_NOTIFICATION_TIME_ZONE,
): string {
  return items
    .slice()
    .sort((left, right) => {
      const leftTs = left.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTs = right.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTs - rightTs;
    })
    .map((item) => renderDigestLine(item, timeZone))
    .join("\n\n");
}

function renderPlanTomorrowDigest(
  context: PlanTomorrowDigestContext,
): RenderedNotificationContent {
  const body = buildDigestItemsText(
    context.items,
    context.timeZone ?? DEFAULT_NOTIFICATION_TIME_ZONE,
  );

  return {
    title: "Завтра в плане",
    body,
    ctaLabel: "Открыть мой план",
    ctaUrl: "/me/plan",
  };
}

export function renderNotificationContentCore(
  scenario: NotificationScenario,
  context: SendNotificationContext,
): RenderedNotificationContent {
  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return renderPlanEvent2hBefore(context);
    case "PLAN_TOMORROW_DIGEST":
      return renderPlanTomorrowDigest(context as PlanTomorrowDigestContext);
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}
