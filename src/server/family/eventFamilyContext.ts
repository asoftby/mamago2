import type { UserEventType } from "@prisma/client";

/**
 * Family Core A2: event types that describe the family plan and therefore
 * always carry `UserEvent.familyId` when the actor belongs to a family.
 * Other events (page views, search, ...) stay family-less on purpose.
 */
export const FAMILY_EVENT_TYPES: ReadonlySet<UserEventType> = new Set<UserEventType>([
  "PLAN_ADD",
  "PLAN_REMOVE",
  "FIRST_PERSONALIZED_PLAN_ADD",
  "PLAN_AUDIENCE_SNAPSHOT",
  "ATTENDED",
  "EXPERIENCE_FEEDBACK",
]);

/**
 * Family id to store on an event. An explicit caller value (including `null`)
 * wins; otherwise family events of an authenticated user resolve the actor's
 * active family through `lookup` (read-only, must not create a family).
 */
export async function resolveEventFamilyId(
  input: { eventType: UserEventType; userId?: string | null; familyId?: string | null },
  lookup: (userId: string) => Promise<string | null>,
): Promise<string | null> {
  if (input.familyId !== undefined) return input.familyId;
  if (!input.userId || !FAMILY_EVENT_TYPES.has(input.eventType)) return null;
  return lookup(input.userId);
}
