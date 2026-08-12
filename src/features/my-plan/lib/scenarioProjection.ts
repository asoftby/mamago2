import type { ScenarioPlanItem } from "@/server/services/dayScenario.service";

export type ScenarioTimeSource = "fixed" | "recovered" | "override" | "flexible";

export interface ScenarioItemTiming {
  effectiveStartsAt: Date | null;
  /** True when there is no fixed/recovered authoritative source time — the
   * item is a genuine "Гибкое время" candidate, regardless of whether an
   * override has been assigned. */
  isFlexible: boolean;
  timeSource: ScenarioTimeSource;
}

/** Minimal shape this resolver needs — structural, not coupled to any one
 * query's exact projection, so both Scenario and My Plan can reuse it. */
export type ScenarioItemTimeInput = {
  startsAt: Date | null;
  activity: { sessions: { startsAt: Date }[] } | null;
};

/**
 * Resolves the time a Scenario item should render/sort by, in priority
 * order: (1) `PlanItem.startsAt` — set at add-time when the user picked a
 * specific session/time, authoritative; (2) a "recovered" time — only when
 * the underlying Activity has exactly one `ActivitySession` on this exact
 * date, so there is nothing to guess between; (3) a user-assigned Scenario
 * override; (4) flexible (no time).
 */
export function resolveScenarioItemTime(
  item: ScenarioItemTimeInput,
  overrideStartsAt: Date | null,
): ScenarioItemTiming {
  if (item.startsAt) {
    return { effectiveStartsAt: item.startsAt, isFlexible: false, timeSource: "fixed" };
  }

  const sessions = item.activity?.sessions ?? [];
  if (sessions.length === 1) {
    return { effectiveStartsAt: sessions[0]!.startsAt, isFlexible: false, timeSource: "recovered" };
  }

  if (overrideStartsAt) {
    return { effectiveStartsAt: overrideStartsAt, isFlexible: true, timeSource: "override" };
  }

  return { effectiveStartsAt: null, isFlexible: true, timeSource: "flexible" };
}

/**
 * My Plan's effective time for one PlanItem: the authoritative source time
 * (`PlanItem.startsAt`) if set, otherwise a Scenario-assigned override time
 * for that item, otherwise untimed. My Plan never loads per-item
 * `ActivitySession` data (that recovery is Scenario-only — see
 * `resolveScenarioItemTime`), so this always passes an empty session list;
 * `PlanItem.startsAt` presence alone already short-circuits before sessions
 * are ever consulted. Reuses `resolveScenarioItemTime` rather than
 * duplicating its priority logic — this function only adapts the shape.
 * Never mutates `PlanItem.startsAt` — purely a read-side projection.
 */
export function resolveMyPlanItemEffectiveTime(
  item: { startsAt: Date | null },
  overrideStartsAt: Date | null,
): Date | null {
  return resolveScenarioItemTime({ startsAt: item.startsAt, activity: null }, overrideStartsAt)
    .effectiveStartsAt;
}

/**
 * No field in the current schema reliably represents an activity's duration
 * (`ActivitySession` has no `endsAt`, `Activity` has no duration column) —
 * always returns null rather than fabricate a default. Wire this up if/when
 * a real duration source is added; every caller already handles `null`
 * (omit, don't show a fake "1 ч").
 */
export function resolveReliableDurationMinutes(_item: ScenarioPlanItem): number | null {
  void _item;
  return null;
}

export interface ScenarioSortableItem {
  id: string;
  effectiveStartsAt: Date | null;
  title: string;
  createdAt: Date;
}

/**
 * Effectively-timed items (fixed, recovered, or override) sort
 * chronologically first; flexible items (no effective time at all) sort
 * after, using the same deterministic title-then-createdAt fallback as
 * `sortPlanItemsForDay`.
 */
export function sortScenarioItemsByEffectiveTime<T extends ScenarioSortableItem>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aHas = a.effectiveStartsAt != null;
    const bHas = b.effectiveStartsAt != null;
    if (aHas && bHas) {
      const diff = a.effectiveStartsAt!.getTime() - b.effectiveStartsAt!.getTime();
      if (diff !== 0) return diff;
    } else if (aHas && !bHas) {
      return -1;
    } else if (!aHas && bHas) {
      return 1;
    }

    const titleCmp = a.title.localeCompare(b.title, "ru");
    if (titleCmp !== 0) return titleCmp;

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export interface ScenarioTimedItem {
  id: string;
  effectiveStartsAt: Date;
  durationMinutes: number | null;
}

/**
 * Free interval between two chronologically adjacent items, only when the
 * earlier item's duration is known — never fabricated. Returns null for
 * overlaps too (that's the conflict warning's job, not a "negative gap").
 */
export function deriveFreeGapMinutes(
  previous: ScenarioTimedItem,
  next: ScenarioTimedItem,
): number | null {
  if (previous.durationMinutes == null) return null;
  const previousEnd = previous.effectiveStartsAt.getTime() + previous.durationMinutes * 60_000;
  const gapMs = next.effectiveStartsAt.getTime() - previousEnd;
  if (gapMs <= 0) return null;
  return Math.round(gapMs / 60_000);
}

/**
 * "День завершится около HH:MM" — only when the chronologically last timed
 * item's duration is known. `sortedTimedItems` must already be sorted by
 * `effectiveStartsAt` ascending.
 */
export function deriveEndOfDay(sortedTimedItems: ScenarioTimedItem[]): Date | null {
  const last = sortedTimedItems.at(-1);
  if (!last || last.durationMinutes == null) return null;
  return new Date(last.effectiveStartsAt.getTime() + last.durationMinutes * 60_000);
}
