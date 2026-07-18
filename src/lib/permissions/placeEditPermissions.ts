/**
 * Place Edit Permissions
 * Centralized permission checks for place editing
 * Business-based ownership model
 */

import type { Role } from "@prisma/client";

import type { CurrentUser } from "@/lib/auth/safeUser";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export interface PlaceEditContext {
  placeId: string;
  createdByUserId: string;
  ownerBusinessId: string | null;
  status: string;
}

/**
 * Check if user can edit a place (async)
 * Rules: business owner OR creator (if no business owner) OR ADMIN OR MODERATOR
 */
export async function canEditPlace(user: CurrentUser | null, place: PlaceEditContext): Promise<boolean> {
  if (!user) return false;
  
  return await canManagePlaceAsync(user, place);
}

/**
 * Check if user can view edit button on public page (async)
 * Same rules as canEditPlace but used for UI visibility
 */
export async function canShowEditButton(user: CurrentUser | null, place: PlaceEditContext): Promise<boolean> {
  return await canEditPlace(user, place);
}

/**
 * A PENDING Place is under moderation review — writes are only allowed
 * for staff (ADMIN/MODERATOR) fixing data before approving it, never for
 * the owner/creator while the submission is being reviewed. Called from
 * `PATCH /api/business/places/[id]` *after* `canManagePlaceAsync` already
 * confirmed the caller may manage this Place at all — this is a separate,
 * status-specific rule on top of that, not a replacement for it.
 */
export function canEditPendingPlace(userRole: Role | undefined): boolean {
  return userRole === "ADMIN" || userRole === "MODERATOR";
}

/**
 * Get edit permission error message
 */
export function getEditPermissionError(user: CurrentUser | null, place: PlaceEditContext): string {
  if (!user) {
    return "Необходимо войти в систему для редактирования места";
  }
  
  return "У вас нет прав для редактирования этого места";
}