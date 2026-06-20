import { BookingStatus } from "@prisma/client";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import type { ParentBookingItem } from "@/server/services/booking/parentBookings.service";

// «июн.» → «июн» — в дизайне месяц в дата-блоке без точки.
const RU_MONTH_SHORT_NODOT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export type StatusTone = {
  label: string;
  color: string;
  bg: string;
  dot: string;
};

/** Статус брони → лейбл и цвета пилюли (цвета из дизайн-токенов). */
export const STATUS_TONE: Record<BookingStatus, StatusTone> = {
  NEW: { label: "Заявка отправлена", color: "var(--warn)", bg: "var(--warn-bg)", dot: "●" },
  CONFIRMED: { label: "Подтверждена", color: "var(--ok)", bg: "var(--ok-bg)", dot: "●" },
  COMPLETED: { label: "Завершено", color: "var(--ink-3)", bg: "rgba(20,18,16,.07)", dot: "✓" },
  REJECTED: { label: "Отклонена", color: "var(--hot)", bg: "var(--hot-bg)", dot: "✕" },
  CANCELLED: { label: "Отменена", color: "var(--ink-3)", bg: "rgba(20,18,16,.07)", dot: "✕" },
};

/** Дата-блок: число + сокращённый месяц (без точки). */
export function dateBlock(iso: string | null): { day: string; month: string } {
  if (!iso) return { day: "—", month: "дата" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "—", month: "дата" };
  return { day: String(d.getDate()), month: RU_MONTH_SHORT_NODOT[d.getMonth()] };
}

/** Основная дата брони: запрошенная дата либо начало смены лагеря. */
export function bookingDateISO(b: ParentBookingItem): string | null {
  return b.requestedDate ?? b.campShiftDateFrom ?? null;
}

/** «заявка от 12 июн.» — когда оставлена заявка. */
export function createdAtLabel(createdAt: string): string {
  const label = formatRuShortDayMonth(createdAt);
  return label ? `заявка от ${label}` : "";
}

/** Подпись времени в строке-мете. */
export function timeLabel(b: ParentBookingItem): string | null {
  if (b.requestedTime) return b.requestedTime;
  if (b.display.subtitle) return b.display.subtitle;
  return null;
}

/** Информация о ребёнке: «Степан, 5 лет». */
export function childLabel(b: ParentBookingItem): string | null {
  const parts = [
    b.childName,
    b.childAge != null ? `${b.childAge} лет` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
