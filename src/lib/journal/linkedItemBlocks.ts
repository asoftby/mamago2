import type { ArticleBlockMvp } from "@/lib/publications/articleMvp";

export type ArticleLinkedItemRow = {
  id: string;
  kind: "EVENT" | "OFFER" | "ARTICLE";
  position: number;
  activityId: string | null;
  offerId: string | null;
  linkedArticleId: string | null;
};

type ActivityCardBlock = Extract<ArticleBlockMvp, { type: "activityCard" }>;

/**
 * Связанные объекты подборки (ArticleLinkedItem) → синтетические блоки
 * `activityCard` в сохранённом порядке (position). Дальше они проходят через
 * существующий резолвер карточек статьи, поэтому внешний вид и правила
 * публичной видимости те же, что у карточек, вставленных в текст.
 */
export function linkedItemsToCardBlocks(rows: readonly ArticleLinkedItemRow[]): ActivityCardBlock[] {
  const blocks: ActivityCardBlock[] = [];
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    const entityId =
      row.kind === "EVENT" ? row.activityId : row.kind === "OFFER" ? row.offerId : row.linkedArticleId;
    if (!entityId) continue;
    blocks.push({
      id: `linked-${row.id}`,
      type: "activityCard",
      entityType: row.kind,
      entityId,
    } as ActivityCardBlock);
  }
  return blocks;
}
