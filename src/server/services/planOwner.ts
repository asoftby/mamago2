/**
 * Plan owner abstraction (forward-to-plan spec v1.2, sections 0 and 5).
 *
 * Contract: all capture code (inbox, parser, planEntry.service) receives a
 * `PlanOwner`, never a bare `userId`. There is no Family model today, so the
 * owner is the user. When `Family` appears, only `PlanOwner` and
 * `resolvePlanOwner` change; callers stay as they are.
 */
export type PlanOwner = {
  userId: string;
};

export function resolvePlanOwner(userId: string): PlanOwner {
  return { userId };
}
