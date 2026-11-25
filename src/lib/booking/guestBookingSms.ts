import type { BookingStatus } from "@prisma/client";

export const BOOKING_DECISION_STATUSES = new Set<BookingStatus>(["CONFIRMED", "REJECTED", "CANCELLED"]);

const compactReasons: Record<string, string> = {
  "Нет свободных мест": "Нет мест",
  "Мероприятие отменено": "Событие отменено",
  "Изменилось расписание": "Изменилось расписание",
  "Участник не соответствует условиям посещения": "Не подходят условия посещения",
};

/** Russian transactional copy always uses Unicode SMS, including UTF-16 surrogate pairs. */
export function unicodeSmsParts(message: string): number {
  return message.length <= 70 ? 1 : Math.ceil(message.length / 67);
}

export function buildGuestBookingSms(input: {
  bookingId: string;
  status: BookingStatus;
  when: string;
  reason: string | null;
}): { message: string; parts: number } {
  if (!BOOKING_DECISION_STATUSES.has(input.status)) throw new Error("Unsupported booking SMS decision");
  const context = input.when || "#" + input.bookingId.slice(-6).toUpperCase();
  const action = input.status === "CONFIRMED" ? "Запись подтверждена" :
    input.status === "REJECTED" ? "Отказ" : "Запись отменена";
  let reason = (input.reason ?? "").replace(/\s+/g, " ").trim();
  for (const [label, compact] of Object.entries(compactReasons)) {
    if (reason === label || reason.startsWith(label + ": ")) {
      reason = compact + reason.slice(label.length);
      break;
    }
  }
  reason = reason.replace(/^Другая причина: /, "");
  const message = "mamaGo.by " + context + "\n" + action +
    (input.status !== "CONFIRMED" && reason ? ". " + reason : ".");
  return { message, parts: unicodeSmsParts(message) };
}
