import type {
  NotificationScenario,
  PlanEventReminderContext,
  PlanTomorrowDigestContext,
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
  const planContext = context as PlanEventReminderContext;
  const startsAtLabel = formatTime(planContext.startsAt);
  const ctaUrl = `/me/day/${formatDateKey(planContext.startsAt)}`;

  return {
    title: "Скоро событие",
    body: `В ${startsAtLabel} у вас в плане: ${planContext.eventTitle}`,
    ctaLabel: "Открыть план",
    ctaUrl,
  };
}

function renderDigestLine(item: PlanTomorrowDigestContext["items"][number]): string {
  const timeLabel = item.startsAt ? `${formatTime(item.startsAt)} — ` : "";
  const titleLine = `${timeLabel}${item.eventTitle}`;
  if (!item.placeName) return titleLine;
  return `${titleLine}\n📍 ${item.placeName}`;
}

function renderPlanTomorrowDigest(
  context: PlanTomorrowDigestContext,
): RenderedNotificationContent {
  const body = context.items
    .slice()
    .sort((left, right) => {
      const leftTs = left.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTs = right.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTs - rightTs;
    })
    .map(renderDigestLine)
    .join("\n\n");

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
