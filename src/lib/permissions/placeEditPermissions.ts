/**
 * Place Edit Permissions
 * Centralized permission checks for place editing
 * Business-based ownership model
 */

import type { User } from "@prisma/client";
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
export async function canEditPlace(user: User | null, place: PlaceEditContext): Promise<boolean> {
  if (!user) return false;
  
  return await canManagePlaceAsync(user, place);
}

/**
 * Check if user can view edit button on public page (async)
 * Same rules as canEditPlace but used for UI visibility
 */
export async function canShowEditButton(user: User | null, place: PlaceEditContext): Promise<boolean> {
  return await canEditPlace(user, place);
}

/**
 * Get edit permission error message
 */
export function getEditPermissionError(user: User | null, place: PlaceEditContext): string {
  if (!user) {
    return "Необходимо войти в систему для редактирования места";
  }
  
  return "У вас нет прав для редактирования этого места";
}