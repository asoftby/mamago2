import type { User } from "@prisma/client";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function canEditOfferForUser(
  user: User,
  offer: { place: { createdByUserId: string; ownerBusinessId: string | null } }
): Promise<boolean> {
  return await canManagePlaceAsync(user, offer.place);
}
