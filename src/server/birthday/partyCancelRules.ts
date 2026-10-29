import { PartyItemStatus, PartyOrderStatus } from "@prisma/client";

/** A party can be cancelled at once only while no performer has confirmed anything. */
export function partyCancelBlocker(order: {
  status: PartyOrderStatus;
  items: Array<{ status: PartyItemStatus; confirmedBookingRequestId: string | null }>;
}): string | null {
  if (order.status === PartyOrderStatus.CANCELLED) return null;
  if (order.status === PartyOrderStatus.ANCHOR_CONFIRMED ||
      order.items.some((item) => item.status === PartyItemStatus.CONFIRMED ||
        item.confirmedBookingRequestId !== null)) {
    return "Часть услуг уже подтверждена исполнителями. Отмена возможна только по их условиям";
  }
  return null;
}
