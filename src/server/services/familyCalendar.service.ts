import { prisma } from "@/lib/prisma";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import { getPlanBookingStates } from "@/server/family/planBooking.service";
import { resolveMyPlanItemEffectiveTime } from "@/features/my-plan/lib/scenarioProjection";
import {
  matchesScenarioPlanFingerprint,
  listActivitySessionsForPlanItems,
  listScenarioItemOverridesForScenarios,
} from "./dayScenario.service";
import {
  listFamilyCalendarItems,
  validateFamilyCalendarRange,
  type FamilyCalendarItemDto,
  ManualPlanEntryError,
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
        ...(await activePlanScopeFor(input.owner.userId)),
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

  const [overrides, sessionsByActivityDate, bookingStates] = await Promise.all([
    listScenarioItemOverridesForScenarios(scenarios.map((scenario) => scenario.id)),
    listActivitySessionsForPlanItems(
      items
        .filter((item) => item.startsAt == null)
        .map((item) => ({ activityId: item.activityId, date: item.date })),
    ),
    getPlanBookingStates(input.owner.userId, items.map((item) => item.id)),
  ]);

  type DatedFingerprintRow = (typeof fingerprintRows)[number] & { date: string };
  const itemsByDate = new Map<string, DatedFingerprintRow[]>();
  for (const item of fingerprintRows) {
    // Prisma's range predicate excludes null at the database boundary, but the
    // generated result type remains nullable after Family Core B0.
    if (item.date == null) continue;
    const rows = itemsByDate.get(item.date) ?? [];
    rows.push({ ...item, date: item.date });
    itemsByDate.set(item.date, rows);
  }

  const scenarioStatusByDate: Record<string, "ready" | "changed"> = {};
  for (const scenario of scenarios) {
    scenarioStatusByDate[scenario.date] = matchesScenarioPlanFingerprint(
      scenario.planFingerprint,
      itemsByDate.get(scenario.date) ?? [],
      overrides,
      scenario.acceptedConflictKeys,
    ) ? "ready" : "changed";
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
      return { ...item, booking: bookingStates.get(item.id) ?? null, effectiveStartsAt: effectiveStartsAt?.toISOString() ?? null };
    }),
    scenarioStatusByDate,
  };
}

/** Mutation responses reuse the exact range projector, including Scenario
 * override and recovered session time semantics. */
export async function loadFamilyCalendarItem(input: {
  owner: PlanOwner;
  item: { id: string; date: string | null };
}): Promise<FamilyCalendarItemDto> {
  if (!input.item.date) throw new ManualPlanEntryError("NOT_FOUND", "calendar_item_has_no_date");
  const range = await loadFamilyCalendarRange({
    owner: input.owner, from: input.item.date, to: input.item.date,
  });
  const item = range.items.find((candidate) => candidate.id === input.item.id);
  if (!item) throw new ManualPlanEntryError("NOT_FOUND", "calendar_item_not_found");
  return item;
}
