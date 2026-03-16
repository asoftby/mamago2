/**
 * Auto-determine CTA button type from participation mode
 * Business doesn't choose CTA manually - it's derived from interaction type
 */

type ParticipationMode = "external-link" | "time-slots" | "simple-booking" | "request" | "info-only";
type CTAType = "details" | "book" | "slot" | "buy" | "request";

export function getCtaFromParticipationMode(participationMode: ParticipationMode): CTAType {
  const mapping: Record<ParticipationMode, CTAType> = {
    "external-link": "buy",        // Купить билет
    "time-slots": "slot",          // Выбрать время
    "simple-booking": "book",      // Записаться
    "request": "request",          // Оставить заявку
    "info-only": "details",        // Подробнее
  };

  return mapping[participationMode] || "details";
}

export function getCtaLabel(ctaType: CTAType): string {
  const labels: Record<CTAType, string> = {
    details: "Подробнее",
    book: "Записаться",
    slot: "Выбрать время",
    buy: "Купить билет",
    request: "Оставить заявку",
  };

  return labels[ctaType] || "Подробнее";
}

/**
 * Get CTA label directly from participation mode
 */
export function getCtaLabelFromParticipationMode(participationMode: ParticipationMode): string {
  const ctaType = getCtaFromParticipationMode(participationMode);
  return getCtaLabel(ctaType);
}
