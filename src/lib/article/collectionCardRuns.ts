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
