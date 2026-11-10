/** Фиксированные подписи CTA превью (без редактирования в форме). */
export const FIXED_PARTICIPATION_CTA_PREVIEW: Record<
  "external-link" | "simple-booking" | "time-slots" | "walk-in" | "prebook" | "request",
  string
> = {
  "external-link": "Купить билет",
  "simple-booking": "Записаться",
  "time-slots": "Выбрать время",
  "walk-in": "Подробнее",
  "prebook": "Записаться",
  "request": "Оставить заявку",
};

export type ParticipationModeUi = keyof typeof FIXED_PARTICIPATION_CTA_PREVIEW;

/**
 * Нормализует режим участия из БД/черновика:
 * «Оставить заявку» (request) — снова настоящий режим: заявка уходит бизнесу через публичную запись.
 * Удалённые сценарии («Только информация») → «Узнать подробнее» (walk-in).
 */
export function normalizeParticipationMode(raw: unknown): ParticipationModeUi {
  const s = typeof raw === "string" ? raw.trim() : raw;
  if (s === "external-link" || s === "time-slots" || s === "walk-in" || s === "prebook" || s === "request" || s === "simple-booking") {
    return s;
  }
  return "walk-in";
}
