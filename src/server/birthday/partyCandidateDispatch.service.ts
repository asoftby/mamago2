import "server-only";
import { BookingKind, BookingStatus, PartyItemRole, PartyOrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { findCandidatesForParty } from "./partyOrderCandidates.service";
import { selectPartyInvitationWave } from "./partyInvitationPolicy";
import { partyResponseDeadline } from "./partyResponseDeadline";
import { verifyPartyOffers } from "./partyDraft.service";
import { partyRequirementsProblem } from "./partySelection";

/**
 * Explicit server-side dispatch primitive. Deliberately not exposed as a route,
 * cron job or automatic hook until multi-response transitions are fully audited.
 * The candidate preview happens outside the transaction; publication and all
 * invitation invariants are checked again under the item row lock.
 */
export async function dispatchPartyCandidateWave(input: {
  ownerUserId: string; partyId: string; itemId: string;
}) {
  const item = await prisma.partyOrderItem.findFirst({
    where: { id: input.itemId, partyOrderId: input.partyId,
      partyOrder: { ownerUserId: input.ownerUserId } },
    select: { category: true },
  });
  if (!item) throw new PartyApiError(404, "Услуга праздника не найдена");
  const historical = await prisma.bookingRequest.findMany({
    where: { kind: BookingKind.PARTY, partyOrderItemId: input.itemId },
    select: { businessId: true },
  });
  const proposal = await findCandidatesForParty(input.ownerUserId, input.partyId, item.category,
    historical.map(request => request.businessId));
  const now = new Date();
  return prisma.$transaction(async tx => {
    // Serializes all dispatch attempts for this party item, even when different
    // request IDs would otherwise bypass each other's row locks.
    await tx.$queryRaw`SELECT "id" FROM "PartyOrderItem"
      WHERE "id" = ${input.itemId} FOR UPDATE`;
    const current = await tx.partyOrderItem.findFirst({
      where: { id: input.itemId, partyOrderId: input.partyId,
        partyOrder: { ownerUserId: input.ownerUserId } },
      select: {
        id: true, category: true, role: true, status: true,
        confirmedBookingRequestId: true,
        partyOrder: { select: {
          id: true, status: true, version: true, ownerUserId: true, citySlug: true,
          eventDate: true, timeFrom: true, timeTo: true,
          childrenCount: true, adultsCount: true, childAge: true,
        } },
        requests: { select: { businessId: true, status: true, partyStage: true } },
      },
    });
    if (!current) throw new PartyApiError(404, "Услуга праздника не найдена");
    const order = current.partyOrder;
    // Candidate selection was computed before the transaction. A changed party
    // must not dispatch invitations for stale date, time or guest requirements.
    if (order.version !== proposal.partyVersion) {
      throw new PartyApiError(409, "Параметры праздника изменились, повторите подбор");
    }
    if ((current.role !== PartyItemRole.ADDON && current.role !== PartyItemRole.STANDALONE) ||
        order.status !== PartyOrderStatus.ANCHOR_CONFIRMED ||
        current.confirmedBookingRequestId ||
        !["PLANNED", "REQUESTED", "NEEDS_DECISION", "EXPIRED"].includes(current.status) ||
        !order.eventDate || !order.timeFrom || !order.timeTo ||
        order.childrenCount === null || order.adultsCount === null)
      throw new PartyApiError(409, "Услуга не готова к приглашениям");
    // EXPIRED is eligible only for a wave that was previously dispatched.
    // This prevents reviving unrelated expired single-offer add-ons.
    if (current.status === "EXPIRED" && current.requests.length === 0)
      throw new PartyApiError(409, "Нет истории приглашений для пополнения");
    const due = partyResponseDeadline(now, partyStartAt(order.eventDate, order.timeFrom));
    if (due <= now) throw new PartyApiError(410, "Срок ответа исполнителя прошёл");
    const invitedBusinessIds = current.requests.map(r => r.businessId);
    const activeBusinessIds = current.requests
      .filter(r => r.status === BookingStatus.NEW &&
        r.partyStage !== null && ["SENT", "QUOTED", "AWAITING_RECONFIRM"].includes(r.partyStage))
      .map(r => r.businessId);
    const wave = selectPartyInvitationWave({
      ranked: proposal.candidates,
      invitedBusinessIds, activeBusinessIds,
    });
    let sent = 0;
    for (const candidate of wave.selected) {
      // Recheck current publication and business ownership inside transaction.
      const published = await verifyPartyOffers(order.citySlug, [candidate.offerId], tx);
      const offer = published.get(candidate.offerId);
      if (!offer || offer.category !== current.category ||
          offer.place?.ownerBusinessId !== candidate.businessId ||
          partyRequirementsProblem(offer, { childrenCount: order.childrenCount,
            childAge: order.childAge })) continue;
      const request = await tx.bookingRequest.create({
        data: {
          kind: BookingKind.PARTY, publicationType: "OFFER",
          userId: order.ownerUserId, businessId: candidate.businessId,
          offerId: candidate.offerId, partyOrderItemId: current.id,
          partyStage: "SENT", status: BookingStatus.NEW,
          requestedDate: order.eventDate, requestedTime: order.timeFrom,
          adultsCount: order.adultsCount, childrenCount: order.childrenCount,
          childAge: order.childAge, customerName: null,
          customerPhone: null, customerComment: null, responseDueAt: due,
        },
        select: { id: true },
      });
      await tx.bookingActivity.create({
        data: { bookingId: request.id, type: "CREATED", actorType: "SYSTEM",
          payload: { partyOrderId: order.id, candidateWave: true } },
      });
      await tx.partyOutbox.create({
        data: { eventType: "PARTY_REQUEST_SENT", aggregateId: request.id,
          dedupeKey: "party:" + request.id + ":sent",
          payload: { partyOrderId: order.id, requestId: request.id,
            businessId: candidate.businessId } },
      });
      sent++;
    }
    if (sent > 0 && current.status !== "REQUESTED") {
      await tx.partyOrderItem.update({
        where: { id: current.id }, data: { status: "REQUESTED" },
      });
    }
    return { partyId: order.id, itemId: current.id, invitationsSent: sent,
      activeInvitations: activeBusinessIds.length + sent };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
}
