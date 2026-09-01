/**
 * Business access via BusinessMember (+ transitional Business.ownerUserId).
 * Platform roles alone (e.g. BUSINESS_OWNER) do not grant access to arbitrary businesses.
 */

import type { Business, BusinessMember, User } from "@prisma/client";
import { BusinessMemberRole } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export type BusinessPermission =
  | "business.view"
  | "business.update"
  | "business.analytics.view"
  | "content.create"
  | "content.update"
  | "content.publish";

/** MVP: OWNER and MANAGER share the same permission set. */
export const rolePermissions: Record<BusinessMemberRole, BusinessPermission[]> = {
  OWNER: [
    "business.view",
    "business.update",
    "business.analytics.view",
    "content.create",
    "content.update",
    "content.publish",
  ],
  MANAGER: [
    "business.view",
    "business.update",
    "business.analytics.view",
    "content.create",
    "content.update",
    "content.publish",
  ],
};

export class BusinessAccessHttpError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = "BusinessAccessHttpError";
  }
}

export function isBusinessAccessHttpError(e: unknown): e is BusinessAccessHttpError {
  return e instanceof BusinessAccessHttpError;
}

export function nextResponseFromBusinessAccessError(error: unknown): NextResponse | null {
  if (isBusinessAccessHttpError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export function hasBusinessPermission(
  role: BusinessMemberRole,
  permission: BusinessPermission,
): boolean {
  return rolePermissions[role].includes(permission);
}

/**
 * Active membership row, or null if none.
 */
export async function getBusinessMembership(
  userId: string,
  businessId: string,
): Promise<BusinessMember | null> {
  return prisma.businessMember.findFirst({
    where: {
      userId,
      businessId,
      isActive: true,
    },
  });
}

/**
 * Owned business only (canonical billing / onboarding owner). Not team membership.
 */
export async function getOwnedBusinessForUser(userId: string): Promise<Business | null> {
  return prisma.business.findUnique({
    where: { ownerUserId: userId },
  });
}

/**
 * Partner cabinet: active BusinessMember (OWNER/MANAGER) is the source of truth; then legacy owned row.
 */
export async function getPartnerCabinetBusiness(userId: string): Promise<Business | null> {
  const member = await prisma.businessMember.findFirst({
    where: {
      userId,
      isActive: true,
      role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
    },
    orderBy: { createdAt: "asc" },
    include: { business: true },
  });

  if (member?.business) {
    return member.business;
  }

  // @deprecated transitional fallback — ticket "BusinessMember backfill".
  // Approve now creates the OWNER membership (businessVerification.service.ts)
  // and the backfill (prisma/scripts/backfill-business-members.ts) ensures every
  // existing business has one, so this branch should no longer be reachable.
  // DO NOT REMOVE until the backfill has run on prod and lived a week without
  // partners losing cabinet access.
  return getOwnedBusinessForUser(userId);
}

/**
 * Membership or legacy owner row (transitional: Business.ownerUserId when no BusinessMember yet).
 */
async function getEffectiveMemberRole(
  userId: string,
  businessId: string,
): Promise<BusinessMemberRole | null> {
  const member = await getBusinessMembership(userId, businessId);
  if (member) return member.role;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerUserId: true },
  });
  // Transitional legacy: treat canonical owner as OWNER-equivalent for permissions
  if (business?.ownerUserId === userId) {
    return BusinessMemberRole.OWNER;
  }

  return null;
}

/**
 * Core check: active membership OR transitional owner match. No platform-role bypass.
 * Use inside guards that already excluded ADMIN / handled MODERATOR.
 */
export async function canAccessBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerUserId: true },
  });

  if (!business) return false;

  if (business.ownerUserId === userId) {
    return true;
  }

  const member = await prisma.businessMember.findFirst({
    where: {
      businessId,
      userId,
      isActive: true,
      role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
    },
    select: { id: true },
  });

  return member !== null;
}

/**
 * Resource guard: ADMIN may access any business for ops; MODERATOR does not get automatic cabinet access here.
 * Transitional: membership + legacy owner via {@link canAccessBusiness}.
 */
export async function canAccessBusinessResource(
  user: Pick<User, "id" | "role"> | null,
  businessId: string,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "MODERATOR") return false;
  return canAccessBusiness(user.id, businessId);
}

export async function requireBusinessAccess(
  user: Pick<User, "id" | "role"> | null,
  businessId: string,
): Promise<void> {
  if (!user) {
    throw new BusinessAccessHttpError(401, "Authentication required");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) {
    throw new BusinessAccessHttpError(404, "Business not found");
  }

  if (user.role === "ADMIN") {
    return;
  }

  if (user.role === "MODERATOR") {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }

  const ok = await canAccessBusiness(user.id, businessId);
  if (!ok) {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }
}

export async function requireBusinessPermission(
  user: Pick<User, "id" | "role"> | null,
  businessId: string,
  permission: BusinessPermission,
): Promise<void> {
  if (!user) {
    throw new BusinessAccessHttpError(401, "Authentication required");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, operationalStatus: true },
  });
  if (!business) {
    throw new BusinessAccessHttpError(404, "Business not found");
  }

  if (user.role === "ADMIN") {
    return;
  }

  if (user.role === "MODERATOR") {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }

  // A suspended/archived business may still be inspected through business.view,
  // but it must not create, update, or submit content through direct API calls.
  if (permission.startsWith("content.") && business.operationalStatus !== "ACTIVE") {
    throw new BusinessAccessHttpError(403, "Business is not active");
  }

  const effectiveRole = await getEffectiveMemberRole(user.id, businessId);
  if (!effectiveRole || !hasBusinessPermission(effectiveRole, permission)) {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }
}

/**
 * Same rules as {@link requireBusinessPermission}, returns boolean (no throw).
 * Use for guards that must not allocate on the failure path beyond one try/catch.
 */
export async function checkUserBusinessPermission(
  user: Pick<User, "id" | "role"> | null,
  businessId: string,
  permission: BusinessPermission,
): Promise<boolean> {
  try {
    await requireBusinessPermission(user, businessId, permission);
    return true;
  } catch (e) {
    if (isBusinessAccessHttpError(e)) {
      return false;
    }
    throw e;
  }
}
