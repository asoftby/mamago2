const INFO_BLOCK_TYPES = new Set(["contacts", "price", "openingHours"]);

export type ArticleRenderGroup<T extends { type: string }> =
  | { kind: "single"; block: T; index: number }
  | { kind: "info"; blocks: T[]; index: number };

/**
 * Contacts/price/openingHours are authored as three independent blocks, but
 * always render as one info card (see ArticleInfoCard) — never as the old
 * three-separate-Shells layout, even when only one of the three is present.
 * Adjacent blocks of these types (with nothing else between them) join the
 * same card; anything else stays untouched. `index` is the position of the
 * group's first block in the original array — callers use it to line up
 * per-position logic (e.g. table-of-contents placement) without
 * re-searching the source array.
 *
 * A run stops as soon as a type would repeat (e.g. contacts, price,
 * contacts) — ArticleInfoCard only has room for one of each section, so a
 * repeated type starts a fresh group instead of silently overwriting the
 * first one's data.
 */
export function groupArticleInfoBlocks<T extends { type: string }>(blocks: T[]): ArticleRenderGroup<T>[] {
  const groups: ArticleRenderGroup<T>[] = [];
  let i = 0;
  while (i < blocks.length) {
    const startIndex = i;
    const block = blocks[i];
    if (INFO_BLOCK_TYPES.has(block.type)) {
      const run: T[] = [];
      const seenTypes = new Set<string>();
      while (i < blocks.length && INFO_BLOCK_TYPES.has(blocks[i].type) && !seenTypes.has(blocks[i].type)) {
        seenTypes.add(blocks[i].type);
        run.push(blocks[i]);
        i += 1;
      }
      groups.push({ kind: "info", blocks: run, index: startIndex });
      continue;
    }
    groups.push({ kind: "single", block, index: startIndex });
    i += 1;
  }
  return groups;
}
