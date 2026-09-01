/** Canonical Activity authorization for business flows. */

import type { AuthActor } from "@/lib/auth/safeUser";
import { BusinessMemberRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { checkUserBusinessPermission } from "@/server/permissions/business-permissions";

export function resolveCanonicalActivityBusinessId(
  activity: { placeId: string | null; businessId: string | null },
  place: { ownerBusinessId: string | null } | null | undefined,
): string | null {
  if (activity.placeId && place?.ownerBusinessId) return place.ownerBusinessId;
  return activity.businessId ?? null;
}

export function coalesceActivityBusinessIdFromPlace(
  place: { ownerBusinessId: string | null } | null | undefined,
  previousBusinessId: string | null,
): string | null {
  return place?.ownerBusinessId ?? previousBusinessId ?? null;
}

export function isActivityBusinessIdAlignedWithPlace(
  place: { ownerBusinessId: string | null } | null | undefined,
  activityBusinessId: string | null,
): boolean {
  if (!place?.ownerBusinessId || !activityBusinessId) return true;
  return activityBusinessId === place.ownerBusinessId;
}

/** Canonical business scopes available through active OWNER/MANAGER memberships. */
export async function getBusinessIdsUserCanAccess(userId: string): Promise<string[]> {
  const memberships = await prisma.businessMember.findMany({
    where: {
      userId,
      isActive: true,
      role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
    },
    select: { businessId: true },
  });
  return [...new Set(memberships.map((membership) => membership.businessId))];
}

export async function canManageActivityContent(
  user: AuthActor,
  params: { canonicalBusinessId: string | null },
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  if (!params.canonicalBusinessId) return false;
  return checkUserBusinessPermission(user, params.canonicalBusinessId, "content.update");
}

export async function canManageActivityById(
  user: AuthActor,
  activityId: string,
): Promise<boolean> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      businessId: true,
      placeId: true,
      place: { select: { ownerBusinessId: true } },
    },
  });
  if (!activity) return false;

  return canManageActivityContent(user, {
    canonicalBusinessId: resolveCanonicalActivityBusinessId(activity, activity.place),
  });
}

/** List query restricted to canonical business scopes. */
export function buildActivityManageWhereForUser(
  _userId: string,
  businessIds: string[],
): { OR: object[] } {
  if (businessIds.length === 0) {
    return { OR: [{ id: "__no_business_access__" }] };
  }
  return {
    OR: [
      { businessId: { in: businessIds } },
      { place: { ownerBusinessId: { in: businessIds } } },
    ],
  };
}
