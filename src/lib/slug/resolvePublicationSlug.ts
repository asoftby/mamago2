import type { Prisma } from "@prisma/client";
import {
  assignArticleSlugIfMissing,
  assignArticleSlugIfMissingInTransaction,
  updateArticleSlug,
  updateArticleSlugInTransaction,
} from "@/lib/slug/articleSlugService";
import {
  EmptyPublicationSlugError,
  isMeaningfulPublicationTitle,
  normalizeSlugStrict,
  slugifyTitle,
} from "@/lib/slug/publicSlug";

export { EmptyPublicationSlugError } from "@/lib/slug/publicSlug";

/** Article: пустой slug → генерация из title; иначе нормализация + уникальность с суффиксом. */
export async function resolveArticleSlugOnSave(
  articleId: string,
  title: string,
  slugInput: string | null | undefined,
): Promise<void> {
  const trimmed = slugInput?.trim();
  if (trimmed) {
    const normalized = normalizeSlugStrict(trimmed);
    if (!normalized) {
      throw new EmptyPublicationSlugError();
    }
    await updateArticleSlug(articleId, trimmed, { strict: false });
    return;
  }

  await assignArticleSlugIfMissing(articleId, title.trim());
}

export async function resolveArticleSlugOnSaveInTransaction(
  tx: Prisma.TransactionClient,
  articleId: string,
  title: string,
  slugInput: string | null | undefined,
): Promise<void> {
  const trimmed = slugInput?.trim();
  if (trimmed) {
    const normalized = normalizeSlugStrict(trimmed);
    if (!normalized) throw new EmptyPublicationSlugError();
    await updateArticleSlugInTransaction(tx, articleId, trimmed, { strict: false });
    return;
  }
  await assignArticleSlugIfMissingInTransaction(tx, articleId, title.trim());
}

/** Preview/fallback без обращения к БД. */
export function resolveSlugCandidate(
  title: string,
  slugInput: string | null | undefined,
  emptyFallback = "item",
): string {
  const trimmed = slugInput?.trim();
  if (trimmed) {
    const strict = normalizeSlugStrict(trimmed);
    return strict || slugifyTitle(trimmed, emptyFallback);
  }
  if (!isMeaningfulPublicationTitle(title)) return "";
  return slugifyTitle(title, emptyFallback);
}
