/** Инбокс сообщает меню, что счётчик мог измениться (ответ, закрытие визита). */
export const BOOKINGS_BADGE_REFRESH_EVENT = "business-bookings-badge-refresh";

export function requestBookingsBadgeRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BOOKINGS_BADGE_REFRESH_EVENT));
  }
}
