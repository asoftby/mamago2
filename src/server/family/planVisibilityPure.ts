import type { PlanDecisionStatus, PlanVisibility } from "@prisma/client";

/**
 * Event types (carrying `meta.planItemId`) that count as a significant action by
 * another adult around a shared plan item: they block FAMILY -> PRIVATE.
 * Viewing, opening the page and receiving a notification are not events here.
 */
export const SIGNIFICANT_OTHER_ACTION_EVENTS = [
  "PLAN_ITEM_RESCHEDULED",
  "PLAN_AUDIENCE_SNAPSHOT",
  "BOOKING_CREATED",
  "ATTENDED",
] as const;

export type VisibilityErrorCode =
  | "disabled"
  | "not_found"
  | "not_author"
  | "wrong_state"
  | "other_adult_acted"
  | "conflict";

export class PlanVisibilityError extends Error {
  constructor(public readonly code: VisibilityErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PlanVisibilityError";
  }
}

type ItemState = {
  userId: string;
  visibility: PlanVisibility;
  status: PlanDecisionStatus;
};

/** PRIVATE CONFIRMED -> FAMILY CONFIRMED, author only. */
export function checkShare(actorId: string, item: ItemState): VisibilityErrorCode | null {
  if (item.userId !== actorId) return "not_author";
  if (item.visibility !== "PRIVATE" || item.status !== "CONFIRMED") return "wrong_state";
  return null;
}

/**
 * FAMILY CONFIRMED -> PRIVATE: author only, and only while no other adult has
 * acted since the last share (`otherAdultActions` = count of such actions).
 */
export function checkMakePrivate(
  actorId: string,
  item: ItemState,
  otherAdultActions: number,
): VisibilityErrorCode | null {
  if (item.userId !== actorId) return "not_author";
  if (item.visibility !== "FAMILY" || item.status !== "CONFIRMED") return "wrong_state";
  if (otherAdultActions > 0) return "other_adult_acted";
  return null;
}

/** Optimistic edit conflict: the client saw a different version than the stored one. */
export function isEditConflict(expectedUpdatedAt: Date | null | undefined, current: Date): boolean {
  if (!expectedUpdatedAt) return false;
  return expectedUpdatedAt.getTime() !== current.getTime();
}
