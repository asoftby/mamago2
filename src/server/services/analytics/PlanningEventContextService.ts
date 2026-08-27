import type { AnalyticsEntityType, Prisma, UserEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";

function asRecord(meta: Prisma.InputJsonValue | undefined): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function isWeekendDate(dateKey: string): boolean {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function entityWhere(
  entityType: AnalyticsEntityType | null | undefined,
  entityId: string | null | undefined,
) {
  if (!entityId) return null;
  switch (entityType) {
    case "EVENT":
      return { activityId: entityId } as const;
    case "PLACE":
      return { placeId: entityId } as const;
    case "ROUTE":
      return { routeId: entityId } as const;
    default:
      return null;
  }
}

/**
 * Adds the actual planning date/timing bucket after a PLAN_ADD write.
 * This keeps planning behaviour correct for every existing save-to-plan UI
 * without requiring each caller to duplicate date classification logic.
 */
export async function enrichPlanningEventMeta(input: {
  userId?: string | null;
  entityType?: AnalyticsEntityType | null;
  entityId?: string | null;
  eventType: UserEventType;
  meta?: Prisma.InputJsonValue;
}): Promise<Prisma.InputJsonValue | undefined> {
  if (input.eventType !== "PLAN_ADD" || !input.userId) return input.meta;

  const current = asRecord(input.meta);
  if (
    typeof current.dateFrom === "string" &&
    typeof current.planningTiming === "string"
  ) {
    return input.meta;
  }

  const entity = entityWhere(input.entityType, input.entityId);
  if (!entity) return input.meta;

  try {
    const planItem = await prisma.planItem.findFirst({
      where: { userId: input.userId, ...entity },
      orderBy: { createdAt: "desc" },
      select: { date: true },
    });
    if (!planItem?.date) return input.meta;

    const today = getLocalDateKey();
    const planningTiming =
      planItem.date === today
        ? "same_day"
        : isWeekendDate(planItem.date)
          ? "weekend"
          : "advance";

    return {
      ...current,
      dateFrom: planItem.date,
      dateTo: planItem.date,
      planningTiming,
    } as Prisma.InputJsonValue;
  } catch (error) {
    console.error("[product-telemetry] planning context enrichment failed", error);
    return input.meta;
  }
}

export const PlanningEventContextService = {
  enrichPlanningEventMeta,
};
