import { prisma } from "@/lib/prisma";
import { activePlanScopeFor } from "@/server/family/familyAccess";

/**
 * Finds the mutable occurrence for an activity. Once a PlanItem has produced
 * an Experience it is immutable history and cannot be reused for a later date.
 */
export async function resolvePlanActivityOccurrence(input: {
  userId: string;
  activityId: string;
  date: string;
}): Promise<
  | { kind: "update"; planItemId: string }
  | { kind: "completed_same_date"; planItemId: string }
  | { kind: "create" }
> {
  const existing = await prisma.planItem.findMany({
    where: { ...(await activePlanScopeFor(input.userId)), activityId: input.activityId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
    select: { id: true, date: true },
  });
  if (existing.length === 0) return { kind: "create" };

  const consumed = new Set(
    (
      await prisma.experience.findMany({
        where: { sourcePlanItemId: { in: existing.map((item) => item.id) } },
        select: { sourcePlanItemId: true },
      })
    ).map((item) => item.sourcePlanItemId),
  );
  const current = existing.find((item) => !consumed.has(item.id));
  if (current) return { kind: "update", planItemId: current.id };

  const completedSameOccurrence = existing.find(
    (item) => consumed.has(item.id) && item.date === input.date,
  );
  return completedSameOccurrence
    ? { kind: "completed_same_date", planItemId: completedSameOccurrence.id }
    : { kind: "create" };
}
