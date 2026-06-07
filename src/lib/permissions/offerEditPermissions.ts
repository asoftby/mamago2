import type { CurrentUser } from "@/lib/auth/safeUser";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function canEditOfferForUser(
  user: CurrentUser,
  offer: { place: { createdByUserId: string; ownerBusinessId: string | null } }
): Promise<boolean> {
  return await canManagePlaceAsync(user, offer.place);
}

/**
 * Кнопка «Редактировать» на публичной странице оффера: админ/модератор
 * или владелец публикации (владелец бизнеса места либо автор черновика места без бизнеса).
 */
export async function canShowOfferOwnerEditOnPublicPage(
  user: CurrentUser,
  place: { createdByUserId: string; ownerBusinessId: string | null },
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }
  if (place.ownerBusinessId) {
    const business = await prisma.business.findUnique({
      where: { id: place.ownerBusinessId },
      select: { ownerUserId: true },
    });
    return business?.ownerUserId === user.id;
  }
  return place.createdByUserId === user.id;
}
