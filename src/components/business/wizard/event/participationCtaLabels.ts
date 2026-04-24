/** Фиксированные подписи CTA превью (без редактирования в форме). */
export const FIXED_PARTICIPATION_CTA_PREVIEW: Record<
  "external-link" | "time-slots" | "walk-in" | "prebook",
  string
> = {
  "external-link": "Купить билет",
  "time-slots": "Выбрать время",
  "walk-in": "Подробнее",
  "prebook": "Записаться",
};

export type ParticipationModeUi = keyof typeof FIXED_PARTICIPATION_CTA_PREVIEW;

/**
 * Нормализует режим участия из БД/черновика:
 * удалённые сценарии («Оставить заявку», «Только информация», simple-booking) → «Узнать подробнее» (walk-in).
 */
export function normalizeParticipationMode(raw: unknown): ParticipationModeUi {
  const s = typeof raw === "string" ? raw.trim() : raw;
  if (s === "external-link" || s === "time-slots" || s === "walk-in" || s === "prebook") {
    return s;
  }
  if (s === "request" || s === "info-only" || s === "simple-booking") {
    return "walk-in";
  }
  return "walk-in";
}
