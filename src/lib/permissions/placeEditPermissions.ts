/**
 * Place Edit Permissions
 * Centralized permission checks for place editing
 */

import type { User } from "@prisma/client";

export interface PlaceEditContext {
  placeId: string;
  ownerUserId: string;
  status: string;
}

/**
 * Check if user can edit a place
 * Rules: owner OR ADMIN OR MODERATOR
 */
export function canEditPlace(user: User | null, place: PlaceEditContext): boolean {
  if (!user) return false;
  
  // Owner can always edit their own places
  if (user.id === place.ownerUserId) return true;
  
  // Admins and moderators can edit any place
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  
  return false;
}

/**
 * Check if user can view edit button on public page
 * Same rules as canEditPlace but used for UI visibility
 */
export function canShowEditButton(user: User | null, place: PlaceEditContext): boolean {
  return canEditPlace(user, place);
}

/**
 * Get edit permission error message
 */
export function getEditPermissionError(user: User | null, place: PlaceEditContext): string {
  if (!user) {
    return "Необходимо войти в систему для редактирования места";
  }
  
  if (!canEditPlace(user, place)) {
    return "У вас нет прав для редактирования этого места";
  }
  
  return "";
}