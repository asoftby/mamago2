import { PartyOrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt, validateSubmissionWindow } from "./partyDraft.validation";
import { verifyPartyOffers } from "./partyDraft.service";

/**
 * Submit only the anchor. No other service receives a request before
 * the venue/package seller responds and the parent accepts the quote.
 */
export async function submitPartyAnchor(
  ownerUserId: string,
  partyId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  const now = new Date();
  const submitKey = partyId + ":" + idempotencyKey;
  const party = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    include: { items: { where: { role: "ANCHOR" } } },
  });
  if (!party) throw new PartyApiError(404, "Праздник не найден");
  if (party.status !== PartyOrderStatus.DRAFT) {
    if (party.submitKey === submitKey) {
      const existing = await prisma.bookingRequest.findFirst({
        where: { kind: "PARTY", partyOrderItem: { partyOrderId: partyId, role: "ANCHOR" } },
        select: { id: true, partyStage: true, responseDueAt: true },
      });
      if (existing) return { partyId, request: existing, alreadySubmitted: true };
    }
    throw new PartyApiError(409, "Праздник уже отправлен");
  }
  if (party.version !== expectedVersion) {
    throw new PartyApiError(409, "Черновик изменился. Обновите страницу");
  }

  const anchor = party.items[0];
  if (party.items.length !== 1 || !anchor || !anchor.offerId || !anchor.businessId) {
    throw new PartyApiError(422, "Выберите основное предложение праздника");
  }
  if (!party.eventDate || !party.timeFrom || !party.timeTo ||
      party.childrenCount == null || party.adultsCount == null ||
      !party.contactName?.trim() || !party.contactPhone?.trim()) {
    throw new PartyApiError(422, "Укажите дату, время, гостей и контакты");
  }
  if (party.timeTo <= party.timeFrom || party.childrenCount < 1 || party.adultsCount < 0) {
    throw new PartyApiError(422, "Проверьте длительность и количество гостей");
  }
  if (!/^\+?[0-9()\-\s]{7,24}$/.test(party.contactPhone.trim())) {
    throw new PartyApiError(422, "Некорректный контактный телефон");
  }
  const eventStart = partyStartAt(party.eventDate, party.timeFrom);
  const responseDueAt = validateSubmissionWindow(eventStart, now);
  const verified = await verifyPartyOffers(party.citySlug, [anchor.offerId]);
  const published = verified.get(anchor.offerId);
  if (!published || published.place?.ownerBusinessId !== anchor.businessId) {
    throw new PartyApiError(422, "Выбранный исполнитель больше не доступен");
  }
  const isVenue = published.category === "VENUE" || published.productType === "PARTY_PACKAGE";
  if ((party.venueMode === "VENUE" || party.venueMode === "PACKAGE") !== isVenue) {
    throw new PartyApiError(422, "Основная услуга не соответствует формату праздника");
  }

  return prisma.$transaction(async (tx) => {
    // Claim the transition before any side effects. A second submit cannot
    // create another BookingRequest even if it arrives concurrently.
    const claimed = await tx.partyOrder.updateMany({
      where: { id: partyId, ownerUserId, version: expectedVersion, status: "DRAFT" },
      data: {
        status: "ANCHOR_PENDING",
        version: { increment: 1 },
        submittedAt: now,
        submitKey,
      },
    });
    if (claimed.count !== 1) {
      const current = await tx.partyOrder.findUnique({ where: { id: partyId } });
      if (current?.submitKey === submitKey) {
        const earlier = await tx.bookingRequest.findFirst({
          where: { kind: "PARTY", partyOrderItemId: anchor.id },
          select: { id: true, partyStage: true, responseDueAt: true },
        });
        if (earlier) return { partyId, request: earlier, alreadySubmitted: true };
      }
      throw new PartyApiError(409, "Заказ изменён или уже отправлен");
    }

    // Re-check publication under the submitting transaction: client snapshots
    // and the preflight query cannot authorize a currently withdrawn offer.
    const checked = await verifyPartyOffers(party.citySlug, [anchor.offerId], tx);
    if (checked.get(anchor.offerId)?.place?.ownerBusinessId !== anchor.businessId) {
      throw new PartyApiError(422, "Выбранный исполнитель больше не доступен");
    }

    const request = await tx.bookingRequest.create({
      data: {
        businessId: anchor.businessId,
        userId: ownerUserId,
        publicationType: "OFFER",
        offerId: anchor.offerId,
        kind: "PARTY",
        partyOrderItemId: anchor.id,
        partyStage: "SENT",
        status: "NEW",
        requestedDate: party.eventDate,
        requestedTime: party.timeFrom,
        customerName: null,
        customerPhone: null,
        adultsCount: party.adultsCount,
        childrenCount: party.childrenCount,
        childAge: party.childAge,
        customerComment: anchor.note,
        responseDueAt,
      },
      select: { id: true, partyStage: true, responseDueAt: true },
    });
    await tx.partyOrderItem.update({
      where: { id: anchor.id },
      data: { status: "REQUESTED" },
    });
    await tx.bookingActivity.create({
      data: {
        bookingId: request.id, type: "CREATED", actorType: "SYSTEM",
        payload: { source: "BIRTHDAY_CONSTRUCTOR", partyOrderId: partyId },
      },
    });
    // Delivery is deliberately asynchronous and must not be attempted here.
    // PR 5 adds the PartyOutbox dispatcher using existing NotificationDelivery.
    await tx.partyOutbox.create({
      data: {
        eventType: "PARTY_REQUEST_SENT",
        aggregateId: request.id,
        dedupeKey: "party:" + request.id + ":sent",
        payload: {
          requestId: request.id,
          businessId: anchor.businessId,
          partyOrderId: partyId,
          category: anchor.category,
          eventDate: party.eventDate.toISOString().slice(0, 10),
          timeFrom: party.timeFrom,
          timeTo: party.timeTo,
          childrenCount: party.childrenCount,
          adultsCount: party.adultsCount,
        },
      },
    });
    return { partyId, request, alreadySubmitted: false };
  });
}
