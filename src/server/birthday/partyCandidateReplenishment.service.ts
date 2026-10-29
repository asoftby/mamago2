import "server-only";
import prisma from "@/lib/prisma";
import { dispatchPartyCandidateWave } from "./partyCandidateDispatch.service";
import { dispatchQueuedPartyInvites } from "./partyInviteTransactionalDispatch.service";
import { queuePartyProviderCandidates } from "./partyInviteQueue.service";
import { findCandidatesForParty } from "./partyOrderCandidates.service";
import { PartyApiError } from "./partyDraft.validation";

/**
 * Called only from the existing authenticated party-outbox cron.
 * Starts category-only waves or replenishes previously STARTED waves; never fixed-offer
 * add-ons. Bounded DB scan, sequential execution, no new scheduler.
 */
export async function replenishPartyCandidateWaves(limit = 10) {
  if (process.env.PARTY_CANDIDATE_AUTO_REPLENISH_ENABLED !== "true")
    return { scanned: 0, sent: 0, skipped: true };
  const boundedLimit = Math.max(1, Math.min(20, limit));
  // Initialize a durable five-provider queue only for category-only add-ons.
  // Explicitly selected fixed offers and legacy started waves retain their old flow.
  const toInitialize = await prisma.partyOrderItem.findMany({
    where: {
      role: "ADDON", status: "PLANNED", offerId: null, businessId: null,
      confirmedBookingRequestId: null,
      partyOrder: { status: "ANCHOR_CONFIRMED", cancelledAt: null },
      requests: { none: {} }, providerInvites: { none: {} },
    },
    orderBy: { updatedAt: "asc" }, take: boundedLimit,
    select: { id: true, category: true, partyOrderId: true,
      partyOrder: { select: { ownerUserId: true } } },
  });
  for (const item of toInitialize) {
    try {
      const proposal = await findCandidatesForParty(
        item.partyOrder.ownerUserId, item.partyOrderId, item.category,
      );
      const chosen = proposal.candidates.slice(0, 5).map(c => ({
        offerId: c.offerId, businessId: c.businessId,
      }));
      if (!chosen.length) continue;
      await prisma.$transaction(async tx => {
        const order = await tx.partyOrder.findUnique({
          where: { id: item.partyOrderId }, select: { version: true },
        });
        if (!order || order.version !== proposal.partyVersion)
          throw new PartyApiError(409, "Праздник изменился во время подбора");
        await queuePartyProviderCandidates(tx, {
          partyOrderItemId: item.id, mode: "PARALLEL", candidates: chosen,
        });
      });
    } catch (error) {
      if (error instanceof PartyApiError && [404, 409, 410, 422].includes(error.status)) continue;
      console.error("[party-replenish] durable queue initialization failed");
    }
  }
  // Durable queues own their items: use the existing cron, never create a second scheduler.
  const queuedItems = await prisma.partyOrderItem.findMany({
    where: {
      role: { in: ["ADDON", "STANDALONE"] },
      status: { in: ["PLANNED", "REQUESTED", "NEEDS_DECISION"] },
      confirmedBookingRequestId: null,
      partyOrder: { status: "ANCHOR_CONFIRMED", cancelledAt: null },
      providerInvites: { some: { status: "QUEUED" } },
    },
    orderBy: { updatedAt: "asc" },
    take: boundedLimit, select: { id: true },
  });
  let sent = 0;
  for (const item of queuedItems) {
    try {
      sent += (await dispatchQueuedPartyInvites(item.id)).sent;
    } catch (error) {
      if (error instanceof PartyApiError && [404, 409, 410, 422].includes(error.status)) continue;
      console.error("[party-replenish] durable queue dispatch failed");
    }
  }
  // Legacy waves are only allowed for items without a durable invitation queue.
  const items = await prisma.partyOrderItem.findMany({
    where: {
      role: { in: ["ADDON", "STANDALONE"] },
      status: { in: ["REQUESTED", "EXPIRED", "NEEDS_DECISION"] },
      confirmedBookingRequestId: null,
      providerInvites: { none: {} },
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
    take: boundedLimit,
    select: { id: true, partyOrderId: true,
      partyOrder: { select: { ownerUserId: true } } },
  });
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
  return { scanned: toInitialize.length + queuedItems.length + items.length, sent, skipped: false };
}
