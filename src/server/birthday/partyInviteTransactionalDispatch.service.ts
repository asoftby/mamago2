import "server-only";

import { BookingKind, BookingStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { verifyPartyOffers } from "./partyDraft.service";
import { partyRequirementsProblem } from "./partySelection";
import { partyResponseDeadline } from "./partyResponseDeadline";
import { decidePartyInviteDispatch } from "./partyInviteDispatchPolicy";

/**
 * Explicit transaction primitive, deliberately not wired to cron/routes.
 * Serializes queue dispatch with the existing PartyOrderItem lock used by
 * dispatchPartyCandidateWave and the confirmation path.
 */
export async function dispatchQueuedPartyInvites(itemId: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "PartyOrderItem" WHERE "id" = ${itemId} FOR UPDATE`;
    const item = await tx.partyOrderItem.findUnique({
      where: { id: itemId },
      select: {
        id: true, role: true, status: true, category: true, confirmedBookingRequestId: true,
        partyOrder: { select: {
          id: true, ownerUserId: true, status: true, citySlug: true,
          eventDate: true, timeFrom: true, timeTo: true,
          childrenCount: true, adultsCount: true, childAge: true,
        } },
        requests: { select: { id: true, businessId: true, partyStage: true, status: true } },
        providerInvites: { orderBy: { position: "asc" }, select: {
          id: true, offerId: true, businessId: true, position: true,
          mode: true, status: true, responseDueAt: true, bookingRequestId: true,
        } },
      },
    });
    if (!item || item.providerInvites.length === 0) return { sent: 0, alreadyQueued: false };
    const order = item.partyOrder;
    if ((item.role !== "ADDON" && item.role !== "STANDALONE") ||
      order.status !== "ANCHOR_CONFIRMED" || item.confirmedBookingRequestId ||
      !["PLANNED", "REQUESTED", "NEEDS_DECISION"].includes(item.status) ||
      !order.eventDate || !order.timeFrom || !order.timeTo ||
      order.childrenCount === null || order.adultsCount === null) {
      throw new PartyApiError(409, "Услуга не готова к отправке приглашений");
    }
    const now = new Date();
    const due = partyResponseDeadline(now, partyStartAt(order.eventDate, order.timeFrom));
    if (due <= now) throw new PartyApiError(410, "Срок ответа исполнителя прошёл");
    const mode = item.providerInvites[0].mode;
    if (item.providerInvites.some(invite => invite.mode !== mode)) {
      throw new PartyApiError(409, "Режимы очереди не совпадают");
    }
    const invited = new Set(item.providerInvites.map(invite => invite.businessId));
    // A request outside the durable queue means the old dispatch path owns this item.
    // Fail closed; never send through two competing mechanisms.
    if (item.requests.some(req => !invited.has(req.businessId))) {
      throw new PartyApiError(409, "Обнаружены заявки вне очереди исполнителей");
    }
    if (item.requests.some(req => req.status === "CONFIRMED" ||
      req.partyStage === "AWAITING_RECONFIRM")) {
      return { sent: 0, alreadyQueued: true };
    }
    const decision = decidePartyInviteDispatch(item.providerInvites, mode, now);
    // Expiry must be settled in BookingRequest as well before advancing a queue.
    // A separate synchronized transition will handle these records.
    if (decision.expireIds.length) return { sent: 0, alreadyQueued: true };
    const selected = item.providerInvites.filter(invite => decision.dispatchIds.includes(invite.id));
    const published = selected.length
      ? await verifyPartyOffers(order.citySlug, selected.map(x => x.offerId), tx)
      : new Map();
    let sent = 0;
    for (const invite of selected) {
      if (invite.bookingRequestId || item.requests.some(req => req.businessId === invite.businessId)) {
        throw new PartyApiError(409, "Исполнитель уже получил приглашение");
      }
      const offer = published.get(invite.offerId);
      if (!offer || offer.productType !== "PARTY_SERVICE" ||
        offer.category !== item.category || offer.place?.ownerBusinessId !== invite.businessId ||
        partyRequirementsProblem(offer, { childrenCount: order.childrenCount, childAge: order.childAge })) {
        throw new PartyApiError(409, "Предложение исполнителя изменилось");
      }
      const claim = await tx.partyProviderInvite.updateMany({
        where: { id: invite.id, status: "QUEUED", bookingRequestId: null },
        data: { status: "SENT", sentAt: now, responseDueAt: due },
      });
      if (claim.count !== 1) throw new PartyApiError(409, "Приглашение уже обрабатывается");
      const request = await tx.bookingRequest.create({
        data: {
          kind: BookingKind.PARTY, publicationType: "OFFER",
          userId: order.ownerUserId, businessId: invite.businessId,
          offerId: invite.offerId, partyOrderItemId: item.id,
          partyStage: "SENT", status: BookingStatus.NEW,
          requestedDate: order.eventDate, requestedTime: order.timeFrom,
          adultsCount: order.adultsCount, childrenCount: order.childrenCount,
          childAge: order.childAge, customerName: null,
          customerPhone: null, customerComment: null, responseDueAt: due,
        },
        select: { id: true },
      });
      await tx.partyProviderInvite.update({
        where: { id: invite.id }, data: { bookingRequestId: request.id },
      });
      await tx.bookingActivity.create({
        data: { bookingId: request.id, type: "CREATED", actorType: "SYSTEM",
          payload: { partyOrderId: order.id, providerInviteId: invite.id } },
      });
      await tx.partyOutbox.create({
        data: { eventType: "PARTY_REQUEST_SENT", aggregateId: request.id,
          dedupeKey: "party:" + request.id + ":sent",
          payload: { partyOrderId: order.id, requestId: request.id,
            businessId: invite.businessId } },
      });
      sent++;
    }
    if (sent > 0 && item.status !== "REQUESTED") {
      await tx.partyOrderItem.update({ where: { id: item.id }, data: { status: "REQUESTED" } });
    }
    return { sent, alreadyQueued: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
}
