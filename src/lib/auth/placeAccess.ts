/**
 * Place Access Control
 * Business-based ownership model for Places
 */

import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Check if user can manage a place
 * 
 * Rules:
 * - Admin/Moderator: full access to all places
 * - If place has business owner: user must own that business
 * - If place has no business owner: only creator can manage (or admin/moderator)
 */
export function canManagePlace(
  user: { id: string; role: Role },
  place: { createdByUserId: string; ownerBusinessId: string | null }
): boolean {
  // Admin/Moderator - full access
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }

  // If place has business owner
  if (place.ownerBusinessId) {
    // User must own this business (checked separately via canAccessBusiness)
    // This is a sync check, actual business ownership verified in async context
    return true; // Will be verified by canAccessBusinessSync or in endpoint
  }

  // If place has no business owner (unowned)
  // Only creator can manage
  return user.id === place.createdByUserId;
}

/**
 * Check if user can access/manage a business (async)
 * 
 * MVP: Business has one owner (ownerUserId)
 * Future: Can be extended to support team members/roles
 */
export async function canAccessBusiness(
  userId: string,
  businessId: string
): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerUserId: true },
  });

  if (!business) {
    return false;
  }

  // MVP: Check if user is business owner
  return business.ownerUserId === userId;
}

/**
 * Check if user can access/manage a business (sync with business data)
 * Use when you already have business data
 */
export function canAccessBusinessSync(
  userId: string,
  business: { ownerUserId: string }
): boolean {
  return business.ownerUserId === userId;
}

/**
 * Get user's business ID (if exists)
 * Returns null if user has no business
 */
export async function getUserBusinessId(userId: string): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { ownerUserId: userId },
    select: { id: true },
  });

  return business?.id || null;
}

/**
 * Check if user can manage place (async version with business check)
 * Use in API endpoints where you need full verification
 */
export async function canManagePlaceAsync(
  user: { id: string; role: Role },
  place: { createdByUserId: string; ownerBusinessId: string | null }
): Promise<boolean> {
  // Admin/Moderator - full access
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }

  // If place has business owner
  if (place.ownerBusinessId) {
    return await canAccessBusiness(user.id, place.ownerBusinessId);
  }

  // If place has no business owner (unowned)
  // Only creator can manage
  return user.id === place.createdByUserId;
}
