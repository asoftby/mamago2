import "server-only";

import { prisma } from "@/lib/prisma";
import { getTelegramRuntimeEnvironment } from "@/server/config/telegram.config";
import type {
  TelegramAnalyticsPeriod,
  TelegramFamilyAnalytics,
} from "@/lib/analytics/telegramAnalyticsTypes";

const DAYS: Record<TelegramAnalyticsPeriod, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

function minskDateKey(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Minsk has a stable UTC+03 offset. Use Minsk calendar days, not server timezone. */
function rangeFor(period: TelegramAnalyticsPeriod) {
  const today = minskDateKey(new Date());
  const todayUtc = new Date(today + "T00:00:00Z");
  todayUtc.setUTCDate(todayUtc.getUTCDate() - DAYS[period] + 1);
  const startDay = todayUtc.toISOString().slice(0, 10);
  return {
    start: new Date(startDay + "T00:00:00+03:00"),
    end: new Date(),
  };
}

function daysBetween(start: Date, end: Date): string[] {
  const from = new Date(minskDateKey(start) + "T00:00:00Z");
  const to = new Date(minskDateKey(end) + "T00:00:00Z");
  const keys: string[] = [];
  for (let day = from; day <= to; day = new Date(day.getTime() + 86_400_000)) {
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
}

/**
 * Actual DEV/PROD bot activity from InboxItem, TelegramConnection and PlanItem.
 * Never loads message texts, photo references, drafts or identifiable names.
 * InboxItem is purged at 30 days. Retention beyond 30 days requires counters.
 */
export async function getTelegramFamilyAnalytics(
  period: TelegramAnalyticsPeriod,
): Promise<TelegramFamilyAnalytics> {
  const environment = getTelegramRuntimeEnvironment();
  const { start, end } = rangeFor(period);

  const [connections, connectedInPeriod, received, planAdds] = await Promise.all([
    prisma.telegramConnection.count({ where: { environment, isActive: true } }),
    prisma.telegramConnection.count({
      where: { environment, isActive: true, linkedAt: { gte: start, lte: end } },
    }),
    prisma.inboxItem.findMany({
      where: { environment, createdAt: { gte: start, lte: end } },
      select: {
        userId: true,
        createdAt: true,
        processedAt: true,
        sourceKind: true,
        anchorIsForward: true,
        status: true,
        editCount: true,
        error: true,
        escalated: true,
        model: true,
        tokensIn: true,
        tokensOut: true,
      },
    }),
    prisma.planItem.findMany({
      where: {
        source: "TELEGRAM_FORWARD",
        createdAt: { gte: start, lte: end },
        inboxItemId: { not: null },
      },
      select: { userId: true, createdAt: true },
    }),
  ]);

  const daysByUser = new Map<string, Set<string>>();
  const usersWithDrafts = new Set<string>();
  const usersConfirmed = new Set<string>();
  const usersAdded = new Set(planAdds.map((item) => item.userId));
  const errors = new Map<string, number>();
  const daily = new Map(daysBetween(start, end).map((date) => [
    date,
    { date, received: 0, addedToPlan: 0 },
  ]));

  let forwardedMessages = 0;
  let draftsPrepared = 0;
  let confirmedMessages = 0;
  let failedMessages = 0;
  let discardedMessages = 0;
  let editedMessages = 0;
  let escalations = 0;
  let modelCalls = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let processingSecondsTotal = 0;
  let processingCount = 0;

  for (const item of received) {
    const date = minskDateKey(item.createdAt);
    const activityDays = daysByUser.get(item.userId) ?? new Set<string>();
    activityDays.add(date);
    daysByUser.set(item.userId, activityDays);
    const bucket = daily.get(date);
    if (bucket) bucket.received += 1;

    if (item.anchorIsForward || item.sourceKind === "FORWARD") forwardedMessages += 1;
    if (["DRAFT_READY", "CONFIRMED", "DISCARDED"].includes(item.status)) {
      draftsPrepared += 1;
      usersWithDrafts.add(item.userId);
    }
    if (item.status === "CONFIRMED") {
      confirmedMessages += 1;
      usersConfirmed.add(item.userId);
    }
    if (item.status === "FAILED") failedMessages += 1;
    if (item.status === "DISCARDED") discardedMessages += 1;
    if (item.editCount > 0) editedMessages += 1;
    if (item.escalated) escalations += 1;
    if (item.model) modelCalls += 1;
    tokensIn += item.tokensIn ?? 0;
    tokensOut += item.tokensOut ?? 0;
    if (item.status === "FAILED" && item.error) {
      errors.set(item.error, (errors.get(item.error) ?? 0) + 1);
    }
    if (item.processedAt) {
      processingSecondsTotal += Math.max(0, item.processedAt.getTime() - item.createdAt.getTime()) / 1000;
      processingCount += 1;
    }
  }

  for (const item of planAdds) {
    const bucket = daily.get(minskDateKey(item.createdAt));
    if (bucket) bucket.addedToPlan += 1;
  }

  return {
    source: "live",
    environment,
    period,
    range: { start: start.toISOString(), end: end.toISOString() },
    connectedTotal: connections,
    connectedInPeriod,
    activeUsers: daysByUser.size,
    returningUsers: [...daysByUser.values()].filter((days) => days.size >= 2).length,
    inboxMessages: received.length,
    forwardedMessages,
    usersWithDrafts: usersWithDrafts.size,
    confirmedUsers: usersConfirmed.size,
    addedPlanUsers: usersAdded.size,
    addedPlanItems: planAdds.length,
    draftsPrepared,
    confirmedMessages,
    failedMessages,
    discardedMessages,
    editedMessages,
    avgProcessingSeconds: processingCount
      ? Math.round((processingSecondsTotal / processingCount) * 10) / 10
      : null,
    modelCalls,
    escalations,
    tokensIn,
    tokensOut,
    errorCodes: [...errors].map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8),
    daily: [...daily.values()],
  };
}
