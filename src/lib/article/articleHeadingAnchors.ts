import type { ArticleBlockMvp, ArticleContentPayload } from "@/lib/publications/articleMvp";

/** Стабильный id для якоря в DOM (TOC / deep links). Основан на id блока в contentJson. */
export function articleHeadingAnchorId(blockId: string): string {
  return `heading-${blockId}`;
}

export type ArticleHeadingEntry = {
  id: string;
  level: 2 | 3;
  text: string;
  anchorId: string;
};

/** Узел оглавления: H2 или одиночный H3 до первого H2; дочерние — H3 под предыдущим H2. */
export type ArticleTocBranch = {
  entry: ArticleHeadingEntry;
  children: ArticleHeadingEntry[];
};

/** Список заголовков из блоков статьи (публичный рендер, превью). */
export function extractHeadingEntriesFromArticleBlocks(
  blocks: ReadonlyArray<ArticleBlockMvp>,
): ArticleHeadingEntry[] {
  return blocks
    .filter((b): b is Extract<ArticleBlockMvp, { type: "heading" }> => b.type === "heading")
    .map((b) => ({
      id: b.id,
      level: b.level,
      text: b.text,
      anchorId: articleHeadingAnchorId(b.id),
    }));
}

/** Foundation для будущего TOC: список заголовков из контента статьи. */
export function extractHeadingEntriesFromArticleContent(
  payload: ArticleContentPayload,
): ArticleHeadingEntry[] {
  return extractHeadingEntriesFromArticleBlocks(payload.blocks);
}

/**
 * Показывать автоматическое оглавление: ≥3 заголовка или ≥2 блока H2.
 */
export function shouldShowArticleToc(entries: ReadonlyArray<ArticleHeadingEntry>): boolean {
  const n = entries.length;
  if (n < 2) return false;
  const h2 = entries.filter((e) => e.level === 2).length;
  return n >= 3 || h2 >= 2;
}

function displayHeadingText(text: string): string {
  const t = text.trim();
  return t || "Без названия";
}

/**
 * Группировка H2 → вложенные H3 (как в типичном TOC). H3 до первого H2 — отдельный верхний пункт.
 */
export function buildArticleTocBranches(entries: ReadonlyArray<ArticleHeadingEntry>): ArticleTocBranch[] {
  const branches: ArticleTocBranch[] = [];
  let current: ArticleTocBranch | null = null;

  for (const e of entries) {
    const entry: ArticleHeadingEntry = {
      ...e,
      text: displayHeadingText(e.text),
    };

    if (entry.level === 2) {
      current = { entry, children: [] };
      branches.push(current);
    } else if (current) {
      current.children.push(entry);
    } else {
      branches.push({ entry, children: [] });
    }
  }

  return branches;
}
