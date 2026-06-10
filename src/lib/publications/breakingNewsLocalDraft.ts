import type { BreakingNewsFormState } from "@/lib/publications/breakingNewsArticle";

export const BREAKING_NEWS_DRAFT_KEY_NEW = "admin:breaking-news:draft:new";

export type BreakingNewsLocalDraft = BreakingNewsFormState & {
  coverImagePreviewUrl: string;
  updatedAt: string;
};

export function breakingNewsDraftKeyEdit(articleId: string): string {
  return `admin:breaking-news:draft:edit:${articleId.trim()}`;
}

export function getBreakingNewsDraftStorageKey(articleId: string | null | undefined): string {
  const id = articleId?.trim();
  return id ? breakingNewsDraftKeyEdit(id) : BREAKING_NEWS_DRAFT_KEY_NEW;
}

function htmlHasText(html: string): boolean {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length > 0;
}

/** Черновик считается пустым, если нет осмысленного пользовательского контента. */
export function isBreakingNewsLocalDraftEmpty(
  draft: Pick<
    BreakingNewsLocalDraft,
    | "title"
    | "slug"
    | "coverImageId"
    | "galleryIds"
    | "bodyHtml"
    | "pricingHtml"
    | "linkedEntityId"
    | "seoTitle"
    | "seoDescription"
    | "seoCanonicalUrl"
    | "scheduledAtLocal"
    | "publishedAtLocal"
  >,
): boolean {
  if (draft.title.trim()) return false;
  if (draft.slug.trim()) return false;
  if (draft.coverImageId.trim()) return false;
  if (draft.galleryIds.length > 0) return false;
  if (htmlHasText(draft.bodyHtml)) return false;
  if (htmlHasText(draft.pricingHtml)) return false;
  if (draft.linkedEntityId.trim()) return false;
  if (draft.seoTitle.trim()) return false;
  if (draft.seoDescription.trim()) return false;
  if (draft.seoCanonicalUrl.trim()) return false;
  if (draft.scheduledAtLocal.trim()) return false;
  if (draft.publishedAtLocal.trim()) return false;
  return true;
}

export function breakingNewsEditorComparable(
  draft: BreakingNewsFormState & { coverImagePreviewUrl: string },
): string {
  return JSON.stringify({
    title: draft.title,
    slug: draft.slug,
    coverImageId: draft.coverImageId,
    coverImagePreviewUrl: draft.coverImagePreviewUrl,
    galleryIds: draft.galleryIds,
    bodyHtml: draft.bodyHtml,
    pricingHtml: draft.pricingHtml,
    linkedEntityType: draft.linkedEntityType,
    linkedEntityId: draft.linkedEntityId,
    status: draft.status,
    scheduledAtLocal: draft.scheduledAtLocal,
    publishedAtLocal: draft.publishedAtLocal,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    seoCanonicalUrl: draft.seoCanonicalUrl,
    noindex: draft.noindex,
    authorUserId: draft.authorUserId,
    geoScope: draft.geoScope,
    cityId: draft.cityId,
  });
}

/** @deprecated Use breakingNewsEditorComparable */
export function breakingNewsLocalDraftComparable(
  draft: Omit<BreakingNewsLocalDraft, "updatedAt">,
): string {
  return breakingNewsEditorComparable(draft);
}

export function buildBreakingNewsLocalDraft(
  formState: BreakingNewsFormState,
  coverImagePreviewUrl: string,
): BreakingNewsLocalDraft {
  return {
    ...formState,
    coverImagePreviewUrl,
    updatedAt: new Date().toISOString(),
  };
}

export function readBreakingNewsLocalDraft(storageKey: string): BreakingNewsLocalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BreakingNewsLocalDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBreakingNewsLocalDraft(
  storageKey: string,
  draft: BreakingNewsLocalDraft,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

export function removeBreakingNewsLocalDraft(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

export function clearBreakingNewsLocalDrafts(articleId: string | null | undefined): void {
  removeBreakingNewsLocalDraft(BREAKING_NEWS_DRAFT_KEY_NEW);
  const id = articleId?.trim();
  if (id) {
    removeBreakingNewsLocalDraft(breakingNewsDraftKeyEdit(id));
  }
}
