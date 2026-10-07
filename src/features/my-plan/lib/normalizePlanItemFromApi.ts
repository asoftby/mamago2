import type { PlanItemWithActivity } from "@/server/services/plan.service";

/** Ответ GET /api/save/plan/day — даты в JSON как строки. */
export function normalizePlanItemsFromApi(raw: unknown[]): PlanItemWithActivity[] {
  return raw.map((row) => {
    const o = row as Record<string, unknown>;
    return {
      ...o,
      startsAt:
        o.startsAt != null && o.startsAt !== ""
          ? new Date(o.startsAt as string)
          : null,
      endsAt:
        o.endsAt != null && o.endsAt !== ""
          ? new Date(o.endsAt as string)
          : null,
      reminderAt:
        o.reminderAt != null && o.reminderAt !== ""
          ? new Date(o.reminderAt as string)
          : null,
      updatedAt:
        o.updatedAt != null && o.updatedAt !== ""
          ? new Date(o.updatedAt as string)
          : undefined,
      createdAt: new Date(o.createdAt as string),
    } as PlanItemWithActivity;
  });
}
