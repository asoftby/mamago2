/**
 * Activity access: canonical business ownership for business flows.
 *
 * Resolution order (see PR3):
 * 1) If activity has placeId and the Place has ownerBusinessId → that business.
 * 2) Else Activity.businessId when set.
 * 3) If no business scope is resolvable, fall back to legacy ownerUserId (transitional).
 */

import type { AuthActor } from "@/lib/auth/safeUser";
import { BusinessMemberRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { checkUserBusinessPermission } from "@/server/permissions/business-permissions";

export function resolveCanonicalActivityBusinessId(
  activity: { placeId: string | null; businessId: string | null },
  place: { ownerBusinessId: string | null } | null | undefined,
): string | null {
  if (activity.placeId) {
    if (place?.ownerBusinessId) {
      return place.ownerBusinessId;
    }
  }
  if (activity.businessId) {
    return activity.businessId;
  }
  return null;
}

/**
 * When place changes, keep denormalized Activity.businessId aligned:
 * prefer the linked place's business; otherwise keep previous value.
 */
export function coalesceActivityBusinessIdFromPlace(
  place: { ownerBusinessId: string | null } | null | undefined,
  previousBusinessId: string | null,
): string | null {
  if (place?.ownerBusinessId) {
    return place.ownerBusinessId;
  }
  return previousBusinessId ?? null;
}

/**
 * When a place is business-owned, denormalized Activity.businessId must not contradict Place.ownerBusinessId.
 */
export function isActivityBusinessIdAlignedWithPlace(
  place: { ownerBusinessId: string | null } | null | undefined,
  activityBusinessId: string | null,
): boolean {
  if (!place?.ownerBusinessId || !activityBusinessId) {
    return true;
  }
  return activityBusinessId === place.ownerBusinessId;
}

export async function getBusinessIdsUserCanAccess(userId: string): Promise<string[]> {
  const owned = await prisma.business.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  const member = await prisma.businessMember.findMany({
    where: {
      userId,
      isActive: true,
      role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
    },
    select: { businessId: true },
  });
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

export async function canManageActivityContent(
  user: AuthActor,
  params: {
    ownerUserId: string;
    canonicalBusinessId: string | null;
  },
): Promise<boolean> {
  // Platform moderation: full access regardless of business membership (legacy behaviour).
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }

  if (params.canonicalBusinessId) {
    // PR2+PR3: business cabinet access via BusinessMember (+ transitional owner in business-permissions).
    return checkUserBusinessPermission(
      user,
      params.canonicalBusinessId,
      "content.update",
    );
  }

  // Transitional legacy: activity without resolvable business scope — ownerUserId-only (pre–businessId / orphan rows).
  return canManageOwnedContent(user, params.ownerUserId);
}

export async function canManageActivityById(
  user: AuthActor,
  activityId: string,
): Promise<boolean> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      ownerUserId: true,
      businessId: true,
      placeId: true,
      place: { select: { ownerBusinessId: true } },
    },
  });

  if (!activity) {
    return false;
  }

  const canonical = resolveCanonicalActivityBusinessId(activity, activity.place);
  return canManageActivityContent(user, {
    ownerUserId: activity.ownerUserId,
    canonicalBusinessId: canonical,
  });
}

/** For list queries: activities the user may manage (legacy owner OR business scope). */
export function buildActivityManageWhereForUser(
  userId: string,
  businessIds: string[],
): { OR: object[] } {
  const or: object[] = [{ ownerUserId: userId }];
  if (businessIds.length > 0) {
    or.push(
      { businessId: { in: businessIds } },
      { place: { ownerBusinessId: { in: businessIds } } },
    );
  }
  return { OR: or };
}
