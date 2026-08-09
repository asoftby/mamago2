import type { AnalyticsEntityType } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * P0 server-side ownership check for the Business Analytics drill-down
 * (Task 3 Business Analytics MVP). Never trust entityId sent by the client —
 * every business analytics detail request must re-verify that the requested
 * publication actually belongs to the caller's own business before any
 * UserEvent aggregation runs.
 *
 * Mirrors the exact ownership rules already used for Business's own content
 * (see `getBusinessWorkspaceData`/`canManageActivityById`/
 * `src/app/api/business/offers/[id]/route.ts`): Event via Activity.businessId
 * / ownerUserId; Offer via the real Offer model's place.ownerBusinessId /
 * place.createdByUserId; Place via its own ownerBusinessId /
 * createdByUserId. Article/Route are never business-owned — always rejected.
 */
export async function businessOwnsPublication(params: {
  userId: string;
  businessId: string;
  entityType: AnalyticsEntityType;
  entityId: string;
}): Promise<boolean> {
  const { userId, businessId, entityType, entityId } = params;

  if (entityType === "EVENT") {
    const row = await prisma.activity.findFirst({
      where: {
        id: entityId,
        type: "EVENT",
        OR: [{ businessId }, { ownerUserId: userId }],
      },
      select: { id: true },
    });
    return !!row;
  }

  if (entityType === "OFFER") {
    const row = await prisma.offer.findFirst({
      where: {
        id: entityId,
        archivedAt: null,
        place: { OR: [{ ownerBusinessId: businessId }, { createdByUserId: userId }] },
      },
      select: { id: true },
    });
    return !!row;
  }

  if (entityType === "PLACE") {
    const row = await prisma.place.findFirst({
      where: {
        id: entityId,
        archivedAt: null,
        OR: [{ ownerBusinessId: businessId }, { createdByUserId: userId }],
      },
      select: { id: true },
    });
    return !!row;
  }

  // ARTICLE / ROUTE: not a business-owned publication type in this MVP — fail closed.
  return false;
}
