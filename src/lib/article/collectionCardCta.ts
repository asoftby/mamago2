import type { ResolvedOfferEmbedCard } from "@/lib/article/articleMvpRenderData";

export type CollectionPrimaryAction = "lead" | "camp-shift" | "phone" | "external" | "details";

/**
 * Основное действие карточки оффера в подборке. «Оставить заявку» (Party-поток) — только у Party-офферов,
 * у остальных кнопка ведёт себя как раньше: смена лагеря, звонок, внешняя запись или страница оффера.
 */
export function collectionPrimaryAction(card: Pick<ResolvedOfferEmbedCard, "party" | "ctaMode" | "ctaPhone" | "ctaHref" | "schedulePreview">): CollectionPrimaryAction {
  if (card.party) return "lead";
  if (card.ctaMode === "camp-shift" && card.schedulePreview.length > 0) return "camp-shift";
  if (card.ctaMode === "phone" && card.ctaPhone) return "phone";
  if (card.ctaMode === "external" && card.ctaHref) return "external";
  return "details";
}
