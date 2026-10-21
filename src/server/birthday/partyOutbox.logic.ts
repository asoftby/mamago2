import { createHash } from "node:crypto";

export type PartyOutboxEventType = "PARTY_REQUEST_SENT" | "PARTY_QUOTE_SENT" | "PARTY_REQUEST_DECLINED" | "PARTY_REQUEST_EXPIRED" | "PARTY_QUOTE_CLOSED" | "PARTY_QUOTE_ACCEPTED";

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
    value === "PARTY_REQUEST_EXPIRED" || value === "PARTY_QUOTE_CLOSED" ||
    value === "PARTY_QUOTE_ACCEPTED";
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
        actionUrl: "/business/bookings?tab=action&kind=party",
      };
    case "PARTY_QUOTE_ACCEPTED":
      return {
        type: "SYSTEM" as const,
        audience: "BUSINESS" as const,
        title: "Клиент принял предложение",
        body: "Предложение по услуге «" + params.offerTitle +
          "» принято клиентом. Требуется проверить доступность и подтвердить заявку.",
        actionUrl: "/business/bookings?tab=action&kind=party",
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
    case "PARTY_QUOTE_CLOSED":
      return {
        type: "SYSTEM" as const,
        audience: "USER" as const,
        title: "Предложение по празднику закрыто",
        body: "Исполнитель закрыл предложение по услуге «" + params.offerTitle +
          "». Можно выбрать другое предложение. Бронирование не подтверждено.",
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

/**
 * Events whose notification links into the unified business inbox stay PENDING (never dropped)
 * until the inbox UI is released and BUSINESS_BOOKINGS_INBOX_UI=true is set.
 */
export function inboxLinkedEventTypes(): PartyOutboxEventType[] {
  return ["PARTY_REQUEST_SENT", "PARTY_QUOTE_ACCEPTED"];
}

export function heldPartyOutboxEventTypes(env: Readonly<Record<string, string | undefined>>): PartyOutboxEventType[] {
  return env.BUSINESS_BOOKINGS_INBOX_UI === "true" ? [] : inboxLinkedEventTypes();
}
