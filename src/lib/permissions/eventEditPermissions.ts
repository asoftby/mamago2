import type { User } from "@prisma/client";
import { ActivityType } from "@prisma/client";
import { canManageActivityById } from "@/lib/auth/activityAccess";

/**
 * Event editor gate: EVENT type + business-first access (see activityAccess).
 */
export async function canEditEventActivity(
  user: User,
  activity: { id: string; type: ActivityType },
): Promise<boolean> {
  if (activity.type !== ActivityType.EVENT) {
    return false;
  }
  return canManageActivityById(user, activity.id);
}
