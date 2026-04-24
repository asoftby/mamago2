/**
 * Auto-determine CTA button type from participation mode
 * Business doesn't choose CTA manually - it's derived from interaction type
 */

type ParticipationMode =
  | "external-link"
  | "prebook"
  | "time-slots"
  | "simple-booking"
  | "request"
  | "info-only"
  | "walk-in";

type CTAType = "details" | "book" | "slot" | "buy" | "request" | "route";

export function getCtaFromParticipationMode(participationMode: ParticipationMode): CTAType {
  if (participationMode === "external-link") return "buy";
  if (participationMode === "prebook") return "book";
  if (participationMode === "time-slots") return "slot";
  // «Узнать подробнее» и все legacy-режимы → основная CTA «Подробнее»
  if (
    participationMode === "walk-in" ||
    participationMode === "request" ||
    participationMode === "info-only" ||
    participationMode === "simple-booking"
  ) {
    return "details";
  }
  return "details";
}

export function getCtaLabel(ctaType: CTAType): string {
  const labels: Record<CTAType, string> = {
    details: "Подробнее",
    book: "Записаться",
    slot: "Выбрать время",
    buy: "Купить билет",
    request: "Оставить заявку",
    route: "Проложить маршрут",
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
