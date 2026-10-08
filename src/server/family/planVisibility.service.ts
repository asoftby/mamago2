import { prisma } from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { planScopeFor } from "./familyAccess";
import { familyReadsEnabled } from "./familyScope";
import {
  PlanVisibilityError,
  SIGNIFICANT_OTHER_ACTION_EVENTS,
  checkMakePrivate,
  checkShare,
  isEditConflict,
} from "./planVisibilityPure";

export { PlanVisibilityError } from "./planVisibilityPure";

type ChangeInput = {
  userId: string;
  planItemId: string;
  /** updatedAt the client last saw (ISO); mismatch => conflict, the fresh item is returned by the caller. */
  expectedUpdatedAt?: Date | null;
  sessionId?: string | null;
};

async function loadItem(userId: string, planItemId: string) {
  if (!familyReadsEnabled()) throw new PlanVisibilityError("disabled");
  const item = await prisma.planItem.findFirst({
    where: { id: planItemId, ...(await planScopeFor(userId)) },
    select: { id: true, userId: true, familyId: true, visibility: true, status: true, createdAt: true, updatedAt: true },
  });
  if (!item) throw new PlanVisibilityError("not_found");
  return item;
}

async function lastSharedAt(planItemId: string, fallback: Date): Promise<Date> {
  const last = await prisma.userEvent.findFirst({
    where: { eventType: "PLAN_ITEM_SHARED", meta: { path: ["planItemId"], equals: planItemId } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? fallback;
}

/** Significant actions on the item by anyone except the author after `since`. */
async function countOtherAdultActions(
  item: { id: string; userId: string; familyId: string | null },
  since: Date,
): Promise<number> {
  const [events, experiences] = await Promise.all([
    prisma.userEvent.count({
      where: {
        eventType: { in: [...SIGNIFICANT_OTHER_ACTION_EVENTS] },
        userId: { not: item.userId },
        createdAt: { gt: since },
        meta: { path: ["planItemId"], equals: item.id },
      },
    }),
    prisma.experience.count({
      where: { sourcePlanItemId: item.id, userId: { not: item.userId }, attendanceConfirmedAt: { gt: since } },
    }),
  ]);
  return events + experiences;
}

async function setVisibility(
  input: ChangeInput,
  from: "PRIVATE" | "FAMILY",
  to: "PRIVATE" | "FAMILY",
  eventType: "PLAN_ITEM_SHARED" | "PLAN_ITEM_MADE_PRIVATE",
) {
  const item = await loadItem(input.userId, input.planItemId);
  const err =
    from === "PRIVATE"
      ? checkShare(input.userId, item)
      : checkMakePrivate(
          input.userId,
          item,
          item.userId === input.userId && item.visibility === "FAMILY" && item.status === "CONFIRMED"
            ? await countOtherAdultActions(item, await lastSharedAt(item.id, item.createdAt))
            : 0,
        );
  if (err) throw new PlanVisibilityError(err);
  if (isEditConflict(input.expectedUpdatedAt, item.updatedAt)) throw new PlanVisibilityError("conflict");

  // Conditional write: a concurrent edit (updatedAt moved) or visibility flip loses.
  const res = await prisma.planItem.updateMany({
    where: { id: item.id, visibility: from, status: "CONFIRMED", updatedAt: item.updatedAt },
    data: { visibility: to },
  });
  if (res.count === 0) throw new PlanVisibilityError("conflict");

  await trackUserEvent({
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    familyId: item.familyId,
    // The made-private event itself must never surface in a family feed.
    planVisibility: to,
    eventType,
    meta: { planItemId: item.id },
  });
  const fresh = await prisma.planItem.findUniqueOrThrow({
    where: { id: item.id },
    select: { id: true, visibility: true, status: true, updatedAt: true },
  });
  return fresh;
}

/** "Поделиться с семьёй": PRIVATE CONFIRMED -> FAMILY CONFIRMED (author only). */
export function sharePlanItemWithFamily(input: ChangeInput) {
  return setVisibility(input, "PRIVATE", "FAMILY", "PLAN_ITEM_SHARED");
}

/** FAMILY -> PRIVATE (author only, before another adult's significant action). */
export function makePlanItemPrivate(input: ChangeInput) {
  return setVisibility(input, "FAMILY", "PRIVATE", "PLAN_ITEM_MADE_PRIVATE");
}
