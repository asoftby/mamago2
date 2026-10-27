import "server-only";
import {
  BookingKind, BookingStatus, PartyItemRole, PartyItemStatus, type Prisma,
} from "@prisma/client";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { verifyPartyOffers } from "./partyDraft.service";
import type { CatalogOffer } from "./partySelection";
import { partyResponseDeadline } from "./partyResponseDeadline";

export type AnchorConfirmedOrder = {
  id: string;
  ownerUserId: string;
  citySlug: string;
  eventDate: Date;
  timeFrom: string;
  childrenCount: number | null;
  adultsCount: number | null;
  childAge: number | null;
};

/**
 * Runs once the anchor is confirmed, by a business (`confirmPartyRequest`) or by the
 * fixed-price rule (`replyToPartyRequest`), inside that same transaction: included
 * package parts become CONFIRMED and every PLANNED add-on gets its own request.
 * Each add-on is claimed PLANNED → REQUESTED before its request is created, so a
 * repeated call cannot create a second request for the same item.
 */
export async function requestPartyAddonsAfterAnchor(
  tx: Prisma.TransactionClient,
  params: { order: AnchorConfirmedOrder; anchorRequestId: string; now: Date },
): Promise<number> {
  const { order, anchorRequestId, now } = params;
  await tx.partyOrderItem.updateMany({
    where: { partyOrderId: order.id, role: PartyItemRole.INCLUDED,
      status: PartyItemStatus.PLANNED },
    data: { status: PartyItemStatus.CONFIRMED },
  });
  const addons = await tx.partyOrderItem.findMany({
    where: { partyOrderId: order.id, role: { in: [PartyItemRole.ADDON, PartyItemRole.STANDALONE] },
      status: PartyItemStatus.PLANNED },
    select: { id: true, offerId: true, businessId: true },
  });
  if (!addons.length) return 0;

  const live = new Map<string, CatalogOffer>();
  // One discontinued add-on must not roll back a confirmed anchor. It
  // becomes NEEDS_DECISION so the parent can select a replacement.
  for (const addon of addons) {
    if (!addon.offerId) continue;
    try {
      const checked = await verifyPartyOffers(order.citySlug, [addon.offerId], tx);
      const candidate = checked.get(addon.offerId);
      if (candidate) live.set(addon.offerId, candidate);
    } catch (error) {
      if (!(error instanceof PartyApiError) || error.status !== 422) throw error;
    }
  }
  const due = partyResponseDeadline(now, partyStartAt(order.eventDate, order.timeFrom));
  let requested = 0;
  for (const addon of addons) {
    const published = addon.offerId ? live.get(addon.offerId) : null;
    if (!addon.businessId || !addon.offerId || !published ||
        published.place?.ownerBusinessId !== addon.businessId || due <= now) {
      await tx.partyOrderItem.updateMany({
        where: { id: addon.id, status: PartyItemStatus.PLANNED },
        data: { status: PartyItemStatus.NEEDS_DECISION },
      });
      continue;
    }
    const claimed = await tx.partyOrderItem.updateMany({
      where: { id: addon.id, status: PartyItemStatus.PLANNED },
      data: { status: PartyItemStatus.REQUESTED },
    });
    if (claimed.count !== 1) continue;
    const child = await tx.bookingRequest.create({
      data: {
        kind: BookingKind.PARTY, publicationType: "OFFER",
        userId: order.ownerUserId, businessId: addon.businessId,
        offerId: addon.offerId, partyOrderItemId: addon.id,
        partyStage: "SENT", status: BookingStatus.NEW,
        requestedDate: order.eventDate, requestedTime: order.timeFrom,
        adultsCount: order.adultsCount ?? 0, childrenCount: order.childrenCount ?? 0,
        childAge: order.childAge,
        customerName: null, customerPhone: null, customerComment: null,
        responseDueAt: due,
      },
      select: { id: true },
    });
    await tx.bookingActivity.create({
      data: { bookingId: child.id, type: "CREATED", actorType: "SYSTEM",
        payload: { partyOrderId: order.id, afterAnchorConfirmation: anchorRequestId } },
    });
    await tx.partyOutbox.create({
      data: { eventType: "PARTY_REQUEST_SENT", aggregateId: child.id,
        dedupeKey: "party:" + child.id + ":sent",
        payload: { partyOrderId: order.id, requestId: child.id, businessId: addon.businessId } },
    });
    requested++;
  }
  return requested;
}
