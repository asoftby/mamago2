import type { PlanItemWithActivity } from "@/server/services/plan.service";

function timeMs(createdAt: PlanItemWithActivity["createdAt"]): number {
  return createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
}

/**
 * Порядок событий внутри одного дня: сначала с временем начала (по возрастанию),
 * без времени — в конце; при равенстве — по названию, затем по createdAt.
 */
export function sortPlanItemsForDay(items: PlanItemWithActivity[]): PlanItemWithActivity[] {
  return [...items].sort((a, b) => {
    const aHas = a.startsAt != null;
    const bHas = b.startsAt != null;
    if (aHas && bHas) {
      const diff = a.startsAt!.getTime() - b.startsAt!.getTime();
      if (diff !== 0) return diff;
    } else if (aHas && !bHas) {
      return -1;
    } else if (!aHas && bHas) {
      return 1;
    }

    const titleA = (a.title ?? a.activity?.title ?? "").trim();
    const titleB = (b.title ?? b.activity?.title ?? "").trim();
    const titleCmp = titleA.localeCompare(titleB, "ru");
    if (titleCmp !== 0) return titleCmp;

    return timeMs(a.createdAt) - timeMs(b.createdAt);
  });
}
