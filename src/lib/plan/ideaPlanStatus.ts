import { getLocalDateKey } from "@/lib/date/localDateKey";

export type IdeaPlanStatus = "UNPLANNED" | "PLANNED_UPCOMING" | "PLANNED_PAST";

export type PlanStatusCandidate = {
  id: string;
  /** null = undated plan item (still counts as "in plan", just without a date). */
  date: string | null;
};

export type ResolvedIdeaPlanState = {
  planStatus: IdeaPlanStatus;
  isPlanned: boolean;
  plannedDate?: string;
  planItemId?: string;
};

export function resolveIdeaPlanState(
  items: PlanStatusCandidate[],
  todayISO: string = getLocalDateKey(),
): ResolvedIdeaPlanState {
  if (items.length === 0) {
    return {
      planStatus: "UNPLANNED",
      isPlanned: false,
    };
  }

  const dated = items.flatMap((item) =>
    item.date === null ? [] : [{ id: item.id, date: item.date }],
  );
  const undated = items.filter((item) => item.date === null);

  const sorted = [...dated].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((item) => item.date >= todayISO);
  if (upcoming.length > 0) {
    const nearest = upcoming[0]!;
    return {
      planStatus: "PLANNED_UPCOMING",
      isPlanned: true,
      plannedDate: nearest.date,
      planItemId: nearest.id,
    };
  }

  // Undated intention: planned, but with no date to show.
  if (undated.length > 0) {
    return {
      planStatus: "PLANNED_UPCOMING",
      isPlanned: true,
      planItemId: undated[0]!.id,
    };
  }

  const past = sorted.filter((item) => item.date < todayISO);
  const latestPast = past[past.length - 1];
  if (latestPast) {
    return {
      planStatus: "PLANNED_PAST",
      isPlanned: false,
      plannedDate: latestPast.date,
      planItemId: latestPast.id,
    };
  }

  return {
    planStatus: "UNPLANNED",
    isPlanned: false,
  };
}
