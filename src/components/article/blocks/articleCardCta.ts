/**
 * Article card intent-driven CTA dictionary.
 * Single source of truth for all article embedded card actions.
 *
 * Rule: CTA answers "What will I do next?" — not "What happens technically?"
 */

export type ArticleCardType = "event" | "place" | "offer" | "route";

export const ARTICLE_CARD_PRIMARY_CTA: Record<ArticleCardType, string> = {
  event: "Пойти",
  place: "Смотреть место",
  offer: "Записаться",
  route: "Начать маршрут",
};
