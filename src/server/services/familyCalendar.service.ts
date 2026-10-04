import { prisma } from "@/lib/prisma";
import { resolveMyPlanItemEffectiveTime } from "@/features/my-plan/lib/scenarioProjection";
import {
  computePlanFingerprint,
  listActivitySessionsForPlanItems,
  listScenarioItemOverridesForScenarios,
} from "./dayScenario.service";
import {
  listFamilyCalendarItems,
  validateFamilyCalendarRange,
  type FamilyCalendarItemDto,
} from "./manualPlanEntry.service";
import type { PlanOwner } from "./planOwner";

export type FamilyCalendarRangePayload = {
  items: FamilyCalendarItemDto[];
  scenarioStatusByDate: Record<string, "ready" | "changed">;
};

/**
 * Bounded range read used by both the initial page and subsequent week
 * navigation. It keeps Scenario status/effective-time semantics identical
 * without exposing route/place/article ids through the calendar DTO.
 */
export async function loadFamilyCalendarRange(input: {
  owner: PlanOwner;
  from: string;
  to: string;
}): Promise<FamilyCalendarRangePayload> {
  const { from, to } = validateFamilyCalendarRange(input.from, input.to);
  const [items, scenarios, fingerprintRows] = await Promise.all([
    listFamilyCalendarItems({ owner: input.owner, from, to }),
    prisma.dayScenario.findMany({
      where: { userId: input.owner.userId, date: { gte: from, lte: to } },
      select: { id: true, date: true, planFingerprint: true, acceptedConflictKeys: true },
    }),
    prisma.planItem.findMany({
      where: {
        userId: input.owner.userId,
        cancelledAt: null,
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        activityId: true,
        routeId: true,
        placeId: true,
        articleId: true,
        date: true,
        startsAt: true,
        endsAt: true,
        childId: true,
      },
    }),
  ]);

  const [overrides, sessionsByActivityDate] = await Promise.all([
    listScenarioItemOverridesForScenarios(scenarios.map((scenario) => scenario.id)),
    listActivitySessionsForPlanItems(
      items
        .filter((item) => item.startsAt == null)
        .map((item) => ({ activityId: item.activityId, date: item.date })),
    ),
  ]);

  const itemsByDate = new Map<string, typeof fingerprintRows>();
  for (const item of fingerprintRows) {
    const rows = itemsByDate.get(item.date) ?? [];
    rows.push(item);
    itemsByDate.set(item.date, rows);
  }

  const scenarioStatusByDate: Record<string, "ready" | "changed"> = {};
  for (const scenario of scenarios) {
    scenarioStatusByDate[scenario.date] = computePlanFingerprint(
      itemsByDate.get(scenario.date) ?? [],
      overrides,
      scenario.acceptedConflictKeys,
    ) === scenario.planFingerprint ? "ready" : "changed";
  }

  return {
    items: items.map((item) => {
      const sessions = item.activityId
        ? (sessionsByActivityDate.get(`${item.activityId}|${item.date}`) ?? [])
        : [];
      const effectiveStartsAt = resolveMyPlanItemEffectiveTime(
        {
          startsAt: item.startsAt ? new Date(item.startsAt) : null,
          sessions: sessions.map((startsAt) => ({ startsAt })),
        },
        overrides.get(item.id) ?? null,
      );
      return { ...item, effectiveStartsAt: effectiveStartsAt?.toISOString() ?? null };
    }),
    scenarioStatusByDate,
  };
}
