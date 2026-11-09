import type { ArticleMvpResolvedBlock } from "./articleMvpRenderData";

type ActivityCardBlock = Extract<ArticleMvpResolvedBlock, { type: "activityCard" }>;

/**
 * Reorder cards only within uninterrupted runs. Editorial headings, copy and
 * galleries remain in the author-defined order and partition the runs.
 * Duplicate references are kept only once across the whole collection.
 */
export function collectionContiguousCardRuns(blocks: readonly ArticleMvpResolvedBlock[]): ActivityCardBlock[][] {
  const seen = new Set<string>();
  const runs: ActivityCardBlock[][] = [];
  let current: ActivityCardBlock[] = [];
  const flush = () => {
    if (current.length) runs.push(current);
    current = [];
  };
  for (const block of blocks) {
    if (block.type !== "activityCard" || !block.card) {
      flush();
      continue;
    }
    const key = `${block.entityType}:${block.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    current.push(block);
  }
  flush();
  return runs;
}

/**
 * The inline TOC must not be attached to a card that cannot render:
 * unpublished/missing cards and duplicate linked references are skipped by
 * the collection renderer. Keeping the authored index preserves placement
 * and heading spacing without changing ARTICLE or BREAKING_NEWS pages.
 */
export function firstRenderableCollectionBodyBlockIndex(
  blocks: readonly ArticleMvpResolvedBlock[],
  suppressedHeadingIds: ReadonlySet<string>,
  renderedRunStartIds: ReadonlySet<string>,
): number {
  return blocks.findIndex((block) => {
    if (block.type === "intro" || suppressedHeadingIds.has(block.id)) return false;
    return block.type !== "activityCard" || renderedRunStartIds.has(block.id);
  });
}
