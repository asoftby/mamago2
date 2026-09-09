const INFO_BLOCK_TYPES = new Set(["contacts", "price", "openingHours"]);

type SubjectAwareBlock = {
  type: string;
  subject?: { id: string } | null;
};

export type ArticleRenderGroup<T extends SubjectAwareBlock> =
  | { kind: "single"; block: T; index: number }
  | { kind: "info"; blocks: T[]; index: number };

function sameSubject(a: SubjectAwareBlock, b: SubjectAwareBlock): boolean {
  const aId = a.subject?.id?.trim() || null;
  const bId = b.subject?.id?.trim() || null;
  // Preserve legacy behaviour for old articles where neither block had a
  // subject, but never merge a named object with an unbound/different object.
  return aId === bId;
}

/**
 * Contacts/price/openingHours are authored independently but adjacent blocks
 * about the same object render as one compact ArticleInfoCard. Subject identity
 * is part of the grouping boundary: neighbouring objects can never be merged
 * into one card merely because their block types happen to be adjacent.
 */
export function groupArticleInfoBlocks<T extends SubjectAwareBlock>(blocks: T[]): ArticleRenderGroup<T>[] {
  const groups: ArticleRenderGroup<T>[] = [];
  let i = 0;
  while (i < blocks.length) {
    const startIndex = i;
    const block = blocks[i];
    if (INFO_BLOCK_TYPES.has(block.type)) {
      const run: T[] = [];
      const seenTypes = new Set<string>();
      const groupSubjectBlock = block;
      while (
        i < blocks.length &&
        INFO_BLOCK_TYPES.has(blocks[i].type) &&
        !seenTypes.has(blocks[i].type) &&
        sameSubject(groupSubjectBlock, blocks[i])
      ) {
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
