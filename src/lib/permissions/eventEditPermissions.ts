import type { CurrentUser } from "@/lib/auth/safeUser";
import { ActivityType } from "@prisma/client";
import { canManageActivityById } from "@/lib/auth/activityAccess";

/**
 * Event editor gate: EVENT type + business-first access (see activityAccess).
 */
export async function canEditEventActivity(
  user: CurrentUser,
  activity: { id: string; type: ActivityType },
): Promise<boolean> {
  if (activity.type !== ActivityType.EVENT) {
    return false;
  }
  return canManageActivityById(user, activity.id);
}
