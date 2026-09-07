const INFO_BLOCK_TYPES = new Set(["contacts", "price", "openingHours"]);

export type ArticleRenderGroup<T extends { type: string }> =
  | { kind: "single"; block: T; index: number }
  | { kind: "info"; blocks: T[]; index: number };

/**
 * Contacts/price/openingHours are authored as three independent blocks, but
 * render as one merged info card whenever they sit back-to-back with nothing
 * else between them (see ArticleInfoCard). Anything else stays untouched.
 * `index` is the position of the group's first block in the original array —
 * callers use it to line up per-position logic (e.g. table-of-contents
 * placement) without re-searching the source array.
 */
export function groupArticleInfoBlocks<T extends { type: string }>(blocks: T[]): ArticleRenderGroup<T>[] {
  const groups: ArticleRenderGroup<T>[] = [];
  let i = 0;
  while (i < blocks.length) {
    const startIndex = i;
    const block = blocks[i];
    if (INFO_BLOCK_TYPES.has(block.type)) {
      const run: T[] = [];
      while (i < blocks.length && INFO_BLOCK_TYPES.has(blocks[i].type)) {
        run.push(blocks[i]);
        i += 1;
      }
      groups.push(run.length > 1 ? { kind: "info", blocks: run, index: startIndex } : { kind: "single", block: run[0], index: startIndex });
      continue;
    }
    groups.push({ kind: "single", block, index: startIndex });
    i += 1;
  }
  return groups;
}
