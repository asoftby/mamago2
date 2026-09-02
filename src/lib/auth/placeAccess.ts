/** Place access control backed by canonical BusinessMember authorization. */

import type { Role } from "@prisma/client";
import {
  canAccessBusiness as canAccessBusinessMember,
  checkUserBusinessPermission,
  getPartnerCabinetBusiness,
} from "@/server/permissions/business-permissions";

/**
 * @deprecated Server authorization must use canManagePlaceAsync.
 * This helper is presentation-only because membership lookup is asynchronous.
 */
export function canManagePlace(
  user: { id: string; role: Role },
  place: { createdByUserId: string; ownerBusinessId: string | null },
): boolean {
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  if (place.ownerBusinessId) return false;
  return user.id === place.createdByUserId;
}

export async function canAccessBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  return canAccessBusinessMember(userId, businessId);
}

/** Canonical cabinet business id from active OWNER/MANAGER membership. */
export async function getUserBusinessId(userId: string): Promise<string | null> {
  const business = await getPartnerCabinetBusiness(userId);
  return business?.id ?? null;
}

/**
 * Full server-side Place mutation authorization.
 * Business-scoped places require content.update on an active business.
 * Business-less legacy/orphan places retain creator ownership until migrated.
 */
export async function canManagePlaceAsync(
  user: { id: string; role: Role },
  place: { createdByUserId: string; ownerBusinessId: string | null } | null,
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  if (!place) return false;
  if (place.ownerBusinessId) {
    return checkUserBusinessPermission(user, place.ownerBusinessId, "content.update");
  }
  return user.id === place.createdByUserId;
}
