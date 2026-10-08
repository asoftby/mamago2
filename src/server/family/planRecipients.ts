/**
 * Family Core M1a: pure fan-out of plan items to notification recipients.
 *
 * One PlanItem used to mean one recipient (`userId`). With two adults, a FAMILY
 * item belongs to every active adult of the family and a PRIVATE item only to
 * its author. The returned copies carry the RECIPIENT in `userId`, so the job
 * cores (settings lookup, dedupe key `scenario:userId:eventId`, send) keep
 * working unchanged and each adult is notified exactly once per item.
 */
export type FanOutItem = {
  userId: string;
  familyId?: string | null;
  visibility?: "PRIVATE" | "FAMILY" | null;
};

/** Reminders: recipients of an item are its family's active adults (FAMILY) or its author (PRIVATE / no family). */
export function fanOutItemsToFamilyMembers<T extends FanOutItem>(
  items: readonly T[],
  activeMembersByFamily: ReadonlyMap<string, readonly string[]>,
): T[] {
  const out: T[] = [];
  for (const item of items) {
    const members =
      item.visibility !== "PRIVATE" && item.familyId
        ? activeMembersByFamily.get(item.familyId)
        : undefined;
    if (!members || members.length === 0) {
      out.push(item);
      continue;
    }
    for (const userId of new Set(members)) out.push({ ...item, userId });
  }
  return out;
}

export type DigestTarget = { userId: string; date: string; familyId: string | null };

/**
 * Digests: an item reaches a target when the dates match and the target may see
 * it: same family and (FAMILY item or own item), or - for a target without a
 * family - an item authored by that user.
 */
export function fanOutItemsToDigestTargets<T extends FanOutItem & { date: string | null }>(
  items: readonly T[],
  targets: readonly DigestTarget[],
): T[] {
  const out: T[] = [];
  for (const item of items) {
    for (const target of targets) {
      if (item.date !== target.date) continue;
      const own = item.userId === target.userId;
      const sameFamily = !!target.familyId && item.familyId === target.familyId;
      const visible = sameFamily ? item.visibility !== "PRIVATE" || own : own && !item.familyId;
      if (visible) out.push({ ...item, userId: target.userId });
    }
  }
  return out;
}
