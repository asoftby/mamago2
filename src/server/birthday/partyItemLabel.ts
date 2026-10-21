import type { PartyItemStatus } from "@prisma/client";

export type PartyItemCustomerLabel =
  | "Ждём ответа" | "Свободен, согласуйте цену" | "Подтверждено исполнителем"
  | "Забронировано" | "Нужна замена";

/**
 * R3: three confirmation levels. "Забронировано" is shown only after the
 * business marked the prepayment; before that the parent sees availability or
 * a confirmation that is not yet a final booking.
 */
export function partyItemCustomerLabel(
  item: { status: PartyItemStatus; prepaidAt?: Date | null },
): PartyItemCustomerLabel {
  switch (item.status) {
    case "CONFIRMED":
      return item.prepaidAt ? "Забронировано" : "Подтверждено исполнителем";
    case "NEEDS_DECISION":
      return "Свободен, согласуйте цену";
    case "DECLINED":
    case "EXPIRED":
    case "CANCELLED":
      return "Нужна замена";
    case "PLANNED":
    case "REQUESTED":
      return "Ждём ответа";
  }
}
