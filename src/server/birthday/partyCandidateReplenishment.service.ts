import "server-only";
import prisma from "@/lib/prisma";
import { dispatchPartyCandidateWave } from "./partyCandidateDispatch.service";
import { PartyApiError } from "./partyDraft.validation";

/**
 * Called only from the existing authenticated party-outbox cron.
 * Starts category-only waves or replenishes previously STARTED waves; never fixed-offer
 * add-ons. Bounded DB scan, sequential execution, no new scheduler.
 */
export async function replenishPartyCandidateWaves(limit = 10) {
  if (process.env.PARTY_CANDIDATE_AUTO_REPLENISH_ENABLED !== "true")
    return { scanned: 0, sent: 0, skipped: true };
  const items = await prisma.partyOrderItem.findMany({
    where: {
      role: { in: ["ADDON", "STANDALONE"] },
      status: { in: ["REQUESTED", "EXPIRED", "NEEDS_DECISION"] },
      confirmedBookingRequestId: null,
      partyOrder: { status: "ANCHOR_CONFIRMED", cancelledAt: null },
      // The initial fanout has a normal CREATED activity; only our wave
      // dispatcher writes candidateWave:true. Never contact extra sellers
      // for a manually selected single-offer booking.
      OR: [
        // First wave: category-only request without any fixed business/offer.
        { role: "ADDON", offerId: null, businessId: null,
          requests: { none: {} } },
        // Follow-up waves: only requests created by our candidate dispatcher.
        { requests: { some: { activities: { some: {
          type: "CREATED", payload: { path: ["candidateWave"], equals: true },
        } } } } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(20, limit)),
    select: { id: true, partyOrderId: true,
      partyOrder: { select: { ownerUserId: true } } },
  });
  let sent = 0;
  for (const item of items) {
    try {
      const result = await dispatchPartyCandidateWave({
        itemId: item.id, partyId: item.partyOrderId,
        ownerUserId: item.partyOrder.ownerUserId,
      });
      sent += result.invitationsSent;
    } catch (error) {
      if (error instanceof PartyApiError && [404, 409, 410, 422].includes(error.status))
        continue;
      // Avoid leaking party identities or booking details in cron logs.
      console.error("[party-replenish] candidate dispatch failed");
    }
  }
  return { scanned: items.length, sent, skipped: false };
}
