import type { CurrentUser } from "@/lib/auth/safeUser";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function canEditOfferForUser(
  user: CurrentUser,
  offer: { place: { createdByUserId: string; ownerBusinessId: string | null } | null }
): Promise<boolean> {
  return await canManagePlaceAsync(user, offer.place);
}

/**
 * Match the public Edit control to the Offer editor's place-scoped permissions.
 * Includes staff and active business OWNER/MANAGER members with content.update.
 */
export async function canShowOfferOwnerEditOnPublicPage(
  user: CurrentUser,
  place: { createdByUserId: string; ownerBusinessId: string | null },
): Promise<boolean> {
  return canManagePlaceAsync(user, place);
}
