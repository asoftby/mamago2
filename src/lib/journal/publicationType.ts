import type { ArticleLinkedItemKind, ArticlePublicationType, Prisma } from "@prisma/client";

/**
 * Журнал: тип публикации — ось «формат», независимая от рубрики (Article.categoryId).
 * Единый модуль правил для админки, публичных лент и тестов.
 */

export const JOURNAL_PUBLICATION_TYPES = ["ARTICLE", "COLLECTION", "BREAKING_NEWS"] as const satisfies readonly ArticlePublicationType[];

/** Срок актуальности новости по умолчанию. */
export const BREAKING_NEWS_DEFAULT_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Минимум элементов в подборке. */
export const COLLECTION_MIN_ITEMS = 3;

export type JournalLinkedItemRef = {
  kind: ArticleLinkedItemKind;
  id: string;
};

export function defaultBreakingNewsExpiresAt(publishedAt: Date): Date {
  return new Date(publishedAt.getTime() + BREAKING_NEWS_DEFAULT_TTL_DAYS * DAY_MS);
}

/**
 * Итоговый expiresAt при сохранении: для новости с датой публикации обязателен
 * (если не задан — publishedAt + 7 дней). Черновик новости без даты публикации
 * может оставаться без срока — он проставится при публикации
 * ({@link resolveBreakingNewsExpiresAtOnPublish}). Для остальных типов — как есть.
 */
export function resolveJournalExpiresAt(input: {
  publicationType: ArticlePublicationType;
  expiresAt: Date | null;
  publishedAt: Date | null;
}): Date | null {
  if (input.publicationType !== "BREAKING_NEWS") return input.expiresAt;
  if (input.expiresAt) return input.expiresAt;
  return input.publishedAt ? defaultBreakingNewsExpiresAt(input.publishedAt) : null;
}

/** При публикации новости модератором: срок, если он не задан или уже прошёл. */
export function resolveBreakingNewsExpiresAtOnPublish(expiresAt: Date | null, publishedAt: Date): Date {
  return expiresAt && expiresAt.getTime() > publishedAt.getTime()
    ? expiresAt
    : defaultBreakingNewsExpiresAt(publishedAt);
}

export function journalLinkedItemKey(item: JournalLinkedItemRef): string {
  return `${item.kind}:${item.id}`;
}

/** Проверка формы элементов публикации (без БД). Бросает Error с текстом для редактора. */
export function assertJournalLinkedItemsShape(input: {
  articleId?: string | null;
  publicationType: ArticlePublicationType;
  items: JournalLinkedItemRef[];
}): void {
  const seen = new Set<string>();
  for (const item of input.items) {
    if (!item.id.trim()) throw new Error("Элемент подборки без объекта");
    if (item.kind === "ARTICLE" && input.articleId && item.id === input.articleId) {
      throw new Error("Публикация не может включать саму себя");
    }
    const key = journalLinkedItemKey(item);
    if (seen.has(key)) throw new Error("Элементы подборки не должны повторяться");
    seen.add(key);
  }
  assertCollectionItemCount(input.publicationType, input.items.length);
}

/** Подборку нельзя сохранить с числом элементов меньше минимума. */
export function assertCollectionItemCount(publicationType: ArticlePublicationType, count: number): void {
  if (publicationType === "COLLECTION" && count < COLLECTION_MIN_ITEMS) {
    throw new Error(`В подборке должно быть минимум ${COLLECTION_MIN_ITEMS} элемента`);
  }
}

export function assertJournalExpiryShape(input: {
  publicationType: ArticlePublicationType;
  expiresAt: Date | null;
  publishedAt: Date | null;
  /** Публикация / отправка на модерацию: срок новости обязателен. */
  publishLike: boolean;
}): void {
  if (input.publicationType !== "BREAKING_NEWS") return;
  if (!input.expiresAt) {
    if (input.publishLike) throw new Error("Для новости укажите «Актуально до»");
    return;
  }
  if (input.publishedAt && input.expiresAt.getTime() <= input.publishedAt.getTime()) {
    throw new Error("«Актуально до» должно быть позже даты публикации");
  }
}

/** true, если материал истёк и не должен появляться в публичных лентах журнала. */
export function isJournalPublicationExpired(
  row: { publicationType: ArticlePublicationType; expiresAt: Date | null },
  now: Date,
): boolean {
  return row.publicationType === "BREAKING_NEWS"
    && (row.expiresAt === null || row.expiresAt.getTime() <= now.getTime());
}

/** Prisma-предикат: исключить истёкшие новости. Остальные типы не фильтруются. */
export function notExpiredJournalPublicationWhere(now: Date): Prisma.ArticleWhereInput {
  return {
    OR: [
      { publicationType: { not: "BREAKING_NEWS" } },
      { publicationType: "BREAKING_NEWS", expiresAt: { gt: now } },
    ],
  };
}
