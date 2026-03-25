import type { User } from "@prisma/client";
import { ActivityType } from "@prisma/client";
import { canManageOwnedContent } from "@/lib/auth/businessContentAccess";

export function canEditEventActivity(
  user: User,
  activity: { ownerUserId: string; type: ActivityType }
): boolean {
  if (activity.type !== ActivityType.EVENT) {
    return false;
  }
  return canManageOwnedContent(user, activity.ownerUserId);
}
