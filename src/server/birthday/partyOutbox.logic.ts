import { createHash } from "node:crypto";

export type PartyOutboxEventType = "PARTY_REQUEST_SENT" | "PARTY_QUOTE_SENT" | "PARTY_REQUEST_DECLINED" | "PARTY_REQUEST_EXPIRED";

export function partyNotificationId(outboxId: string, recipientId: string): string {
  return "party-" + createHash("sha256").update(outboxId + ":" + recipientId).digest("hex").slice(0, 32);
}

export function partyOutboxBackoff(attempt: number): number {
  return Math.min(60, 2 ** Math.min(6, Math.max(0, attempt))) * 60_000;
}

export function isPartyOutboxEventType(value: string): value is PartyOutboxEventType {
  return value === "PARTY_REQUEST_SENT" ||
    value === "PARTY_QUOTE_SENT" ||
    value === "PARTY_REQUEST_DECLINED" ||
    value === "PARTY_REQUEST_EXPIRED";
}

export function partyOutboxCopy(params: {
  type: PartyOutboxEventType;
  offerTitle: string;
  dateLabel: string;
}) {
  switch (params.type) {
    case "PARTY_REQUEST_SENT":
      return {
        type: "BOOKING_CREATED" as const,
        audience: "BUSINESS" as const,
        title: "Новая заявка на праздник",
        body: "Новая заявка на «" + params.offerTitle + "» на " + params.dateLabel +
          ". Ответьте в разделе «Праздники».",
        actionUrl: "/business/bookings?tab=parties",
      };
    case "PARTY_QUOTE_SENT":
      return {
        type: "SYSTEM" as const,
        audience: "USER" as const,
        title: "Исполнитель ответил на заявку",
        body: "По услуге «" + params.offerTitle + "» поступило предложение. " +
          "Стоимость и условия нужно проверить и принять. Бронирование ещё не подтверждено.",
        actionUrl: "/me/birthdays",
      };
    case "PARTY_REQUEST_EXPIRED":
      return {
        type: "SYSTEM" as const,
        audience: "USER" as const,
        title: "Исполнитель не ответил вовремя",
        body: "По услуге «" + params.offerTitle + "» истёк срок ответа. " +
          "Можно будет выбрать другого исполнителя. Бронирование не создано.",
        actionUrl: "/me/birthdays",
      };
    case "PARTY_REQUEST_DECLINED":
      return {
        type: "SYSTEM" as const,
        audience: "USER" as const,
        title: "Исполнитель не сможет выполнить заявку",
        body: "По услуге «" + params.offerTitle + "» получен отказ. " +
          "Можно будет выбрать другого исполнителя. Бронирование не создано.",
        actionUrl: "/me/birthdays",
      };
  }
}
