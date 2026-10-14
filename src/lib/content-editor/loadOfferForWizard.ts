import prisma from "@/lib/prisma";
import { applyRevisionToOffer, type OfferRevisionPayload } from "@/lib/offers/offerRevisionPayload";

/**
 * Single Prisma load for offer editor + wizard mapping.
 * Для автора (не админ/модератор) к живой строке применяются его ожидающие правки опубликованного оффера
 * (OfferRevision), чтобы редактор показывал предложенные значения. Админ/модератор видят живую версию.
 */
export async function loadOfferForWizard(offerId: string, options?: { viewerEditsLive?: boolean }) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      place: {
        select: {
          id: true,
          createdByUserId: true,
          ownerBusinessId: true,
          title: true,
          city: {
            select: {
              slug: true,
            },
          },
        },
      },
      placements: {
        orderBy: { createdAt: "asc" },
      },
      categoryLinks: {
        orderBy: { sortOrder: "asc" },
      },
      openingHours: {
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!offer) {
    return { offer: null, offerForWizard: null, pendingRevision: null };
  }

  const pendingRevision = options?.viewerEditsLive
    ? null
    : await prisma.offerRevision.findFirst({
        where: { offerId, status: "PENDING" },
        select: { id: true, payload: true, changedFields: true },
      });

  let offerForWizard = pendingRevision
    ? applyRevisionToOffer(offer, pendingRevision.payload as OfferRevisionPayload)
    : offer;

  // Ожидающая смена места: форме нужны данные нового места (название, город), а не только placeId.
  const pendingPlaceId = (pendingRevision?.payload as OfferRevisionPayload | undefined)?.placeId;
  if (typeof pendingPlaceId === "string" && pendingPlaceId !== offer.placeId) {
    const place = await prisma.place.findUnique({
      where: { id: pendingPlaceId },
      select: {
        id: true,
        createdByUserId: true,
        ownerBusinessId: true,
        title: true,
        city: { select: { slug: true } },
      },
    });
    if (place) offerForWizard = { ...offerForWizard, placeId: place.id, place };
  }

  return {
    offer,
    offerForWizard,
    pendingRevision: pendingRevision
      ? { id: pendingRevision.id, fields: pendingRevision.changedFields }
      : null,
  };
}
