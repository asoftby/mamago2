import type { ArticleMvpResolvedBlock } from "./articleMvpRenderData";

/** Only identical editorial headings directly preceding a resolved card are redundant.
 * Preserve descriptive editorial headings, including those with their own meaning.
 */
export function collectionDuplicateHeadingIds(blocks: readonly ArticleMvpResolvedBlock[]): Set<string> {
  const duplicates = new Set<string>();
  const normalize = (text: string) => text.trim().replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").toLocaleLowerCase("ru");
  for (let i = 0; i + 1 < blocks.length; i++) {
    const heading = blocks[i];
    const cardBlock = blocks[i + 1];
    if (heading.type !== "heading" || cardBlock.type !== "activityCard") continue;
    const card = cardBlock.card;
    if (!card || !("title" in card) || !card.title) continue;
    if (normalize(heading.text) === normalize(card.title)) duplicates.add(heading.id);
  }
  return duplicates;
}
