/**
 * Canonical business authorization.
 *
 * BusinessMember is the source of truth for partner access. Platform roles are
 * only staff capabilities; BUSINESS_OWNER is not an authorization primitive.
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

export function isPlatformContentStaff(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

export function hasBusinessPermission(
  role: BusinessMemberRole,
  permission: BusinessPermission,
): boolean {
  return rolePermissions[role].includes(permission);
}

/** Active membership row, or null if none. */
export async function getBusinessMembership(
  userId: string,
  businessId: string,
): Promise<BusinessMember | null> {
  return prisma.businessMember.findFirst({
    where: {
      userId,
      businessId,
      isActive: true,
      role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
    },
  });
}

/** Owned business metadata only. Do not use this as an authorization check. */
export async function getOwnedBusinessForUser(userId: string): Promise<Business | null> {
  return prisma.business.findUnique({ where: { ownerUserId: userId } });
}

/** Partner cabinet business resolved only through canonical active membership. */
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
  return member?.business ?? null;
}

async function getEffectiveMemberRole(
  userId: string,
  businessId: string,
): Promise<BusinessMemberRole | null> {
  const member = await getBusinessMembership(userId, businessId);
  return member?.role ?? null;
}

/** Canonical resource access: active membership only (ADMIN ops bypass). */
export async function canAccessBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  return (await getBusinessMembership(userId, businessId)) !== null;
}

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

  if (user.role === "ADMIN") return;
  if (user.role === "MODERATOR") {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }

  if (!(await canAccessBusiness(user.id, businessId))) {
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

  if (user.role === "ADMIN") return;
  if (user.role === "MODERATOR") {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }

  // Suspended/archived businesses may be inspected but cannot mutate content.
  if (permission.startsWith("content.") && business.operationalStatus !== "ACTIVE") {
    throw new BusinessAccessHttpError(403, "Business is not active");
  }

  const effectiveRole = await getEffectiveMemberRole(user.id, businessId);
  if (!effectiveRole || !hasBusinessPermission(effectiveRole, permission)) {
    throw new BusinessAccessHttpError(403, "Forbidden");
  }
}

export async function checkUserBusinessPermission(
  user: Pick<User, "id" | "role"> | null,
  businessId: string,
  permission: BusinessPermission,
): Promise<boolean> {
  try {
    await requireBusinessPermission(user, businessId, permission);
    return true;
  } catch (e) {
    if (isBusinessAccessHttpError(e)) return false;
    throw e;
  }
}

/**
 * Canonical gate for non-resource-specific B2B tools (media picker, AI helpers,
 * temp uploads, etc.). Staff may use editorial tools; partners need an active
 * BusinessMember with the requested permission on their cabinet business.
 */
export async function checkBusinessToolPermission(
  user: Pick<User, "id" | "role"> | null,
  permission: BusinessPermission = "content.create",
): Promise<boolean> {
  if (!user) return false;
  if (isPlatformContentStaff(user.role)) return true;

  const business = await getPartnerCabinetBusiness(user.id);
  if (!business) return false;
  return checkUserBusinessPermission(user, business.id, permission);
}
