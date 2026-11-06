/** Фиксированные подписи CTA превью (без редактирования в форме). */
export const FIXED_PARTICIPATION_CTA_PREVIEW: Record<
  "external-link" | "time-slots" | "walk-in" | "prebook" | "request",
  string
> = {
  "external-link": "Купить билет",
  "time-slots": "Выбрать время",
  "walk-in": "Подробнее",
  "prebook": "Записаться",
  "request": "Оставить заявку",
};

export type ParticipationModeUi = keyof typeof FIXED_PARTICIPATION_CTA_PREVIEW;

/**
 * Нормализует режим участия из БД/черновика:
 * «Оставить заявку» (request) — снова настоящий режим: заявка уходит бизнесу через публичную запись.
 * Удалённые сценарии («Только информация», simple-booking) → «Узнать подробнее» (walk-in).
 */
export function normalizeParticipationMode(raw: unknown): ParticipationModeUi {
  const s = typeof raw === "string" ? raw.trim() : raw;
  if (s === "external-link" || s === "time-slots" || s === "walk-in" || s === "prebook" || s === "request") {
    return s;
  }
  if (s === "info-only" || s === "simple-booking") {
    return "walk-in";
  }
  return "walk-in";
}
