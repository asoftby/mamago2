import type { User } from "@prisma/client";
import { canManageOwnedContent } from "@/lib/auth/businessContentAccess";

export function canEditOfferForUser(
  user: User,
  offer: { place: { ownerUserId: string } }
): boolean {
  return canManageOwnedContent(user, offer.place.ownerUserId);
}
