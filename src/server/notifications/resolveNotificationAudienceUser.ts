import "server-only";

import type { User } from "@prisma/client";
import { getPartnerCabinetBusiness } from "@/server/permissions/business-permissions";

export type NotificationAudienceUser = {
  id: string;
  role: string;
  business: { id: string } | null;
};

/**
 * Resolves business cabinet context for notification audience filtering.
 */
export async function resolveNotificationAudienceUser(
  user: User,
): Promise<NotificationAudienceUser> {
  const cabinet = await getPartnerCabinetBusiness(user.id);
  return {
    id: user.id,
    role: user.role,
    business: cabinet ? { id: cabinet.id } : null,
  };
}
