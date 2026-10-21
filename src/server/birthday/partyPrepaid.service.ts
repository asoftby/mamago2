import "server-only";
import { BookingKind, BookingStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError } from "./partyDraft.validation";

/**
 * R3: the business marks the final booking (prepayment received). Only a
 * request already CONFIRMED can be marked; a repeat returns the same result.
 */
export async function markPartyPrepaid(params: {
  businessId: string; actorUserId: string; requestId: string; idempotencyKey: string;
}) {
  const { businessId, actorUserId, requestId, idempotencyKey } = params;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "BookingRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    const req = await tx.bookingRequest.findFirst({
      where: { id: requestId, businessId, kind: BookingKind.PARTY },
      select: {
        id: true, status: true, partyStage: true, lastActivityAt: true,
        partyOrderItem: { select: { id: true, prepaidAt: true, confirmedBookingRequestId: true } },
      },
    });
    // Another business's request is indistinguishable from a missing one.
    if (!req || !req.partyOrderItem) throw new PartyApiError(404, "Праздничная заявка не найдена");
    const item = req.partyOrderItem;
    if (item.prepaidAt) {
      return { requestId, prepaidAt: item.prepaidAt, alreadyMarked: true };
    }
    if (req.status !== BookingStatus.CONFIRMED || req.partyStage !== "CONFIRMED" ||
        item.confirmedBookingRequestId !== requestId) {
      throw new PartyApiError(409, "Предоплату можно отметить только у подтверждённой заявки");
    }
    const now = new Date();
    const claimed = await tx.bookingRequest.updateMany({
      where: { id: requestId, businessId, lastActivityAt: req.lastActivityAt },
      data: { lastActivityAt: now },
    });
    if (claimed.count !== 1) throw new PartyApiError(409, "Заявка уже изменена");
    const marked = await tx.partyOrderItem.updateMany({
      where: { id: item.id, prepaidAt: null },
      data: { prepaidAt: now, prepaidMarkedByUserId: actorUserId },
    });
    if (marked.count !== 1) throw new PartyApiError(409, "Заявка уже изменена");
    await tx.bookingActivity.create({
      data: {
        bookingId: requestId, type: "PREPAYMENT_MARKED", actorType: "BUSINESS",
        actorId: actorUserId, payload: { idempotencyKey },
      },
    });
    return { requestId, prepaidAt: now, alreadyMarked: false };
  });
}
