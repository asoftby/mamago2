import prisma from "@/lib/prisma";

/**
 * Single Prisma load for offer editor + wizard mapping.
 * No OfferRevision model — returned entity is the source of truth.
 */
export async function loadOfferForWizard(offerId: string) {
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
    return { offer: null, offerForWizard: null };
  }

  return { offer, offerForWizard: offer };
}
