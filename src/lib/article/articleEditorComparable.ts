import { ContentStatus, type GeoScope } from "@prisma/client";
import type { ArticleEditorSnapshot } from "@/lib/article/articleAdminTypes";
import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

export function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDatetimeValue(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Единственный источник нормализации полей для сравнения dirty-состояния.
 * И «сохранённый» (из snapshot сервера), и «текущий» (из live form state)
 * comparable ОБЯЗАНЫ идти через эту функцию — раздельные inline-нормализации
 * в разных местах разошлись однажды (authorUserId: `?? ""` vs `?? null`),
 * из-за чего dirty навсегда оставался true после save и success modal
 * конфликтовал со вторым popup «уйти без сохранения» (см.
 * articleEditorComparable.test.ts).
 */
export function buildEditorComparable(input: {
  title: string;
  slug: string | null;
  coverImageId: string | null;
  authorUserId: string | null;
  authorLabel: string | null;
  cityContext: string | null;
  categoryId: string | null;
  tagIds: string[];
  geoScope: GeoScope | null;
  cityId: string | null;
  regionId: string | null;
  content: ArticleContentPayload;
  status: ContentStatus;
  publishedAtLocal: string;
  scheduledAtLocal: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  noindex: boolean;
}): string {
  return JSON.stringify({
    title: input.title,
    slug: input.slug ?? "",
    coverImageId: input.coverImageId ?? "",
    authorUserId: input.authorUserId ?? null,
    authorLabel: input.authorLabel ?? "",
    cityContext: input.cityContext ?? "",
    categoryId: input.categoryId ?? "",
    tagIds: input.tagIds,
    geoScope: input.geoScope ?? null,
    cityId: input.cityId ?? "",
    regionId: input.regionId ?? "",
    content: input.content,
    status: input.status,
    publishedAtLocal: input.publishedAtLocal,
    scheduledAtLocal: input.scheduledAtLocal,
    seoTitle: input.seoTitle ?? "",
    seoDescription: input.seoDescription ?? "",
    seoCanonicalUrl: input.seoCanonicalUrl ?? "",
    noindex: input.noindex,
  });
}

/** Comparable «сохранённой» версии — из snapshot сервера (initial props / save response). */
export function buildSavedComparable(snap: ArticleEditorSnapshot): string {
  return buildEditorComparable({
    title: snap.title,
    slug: snap.slug,
    coverImageId: snap.coverImageId,
    authorUserId: snap.authorUserId,
    authorLabel: snap.authorLabel,
    cityContext: snap.cityContext,
    categoryId: snap.categoryId,
    tagIds: snap.tagIds,
    geoScope: snap.geoScope,
    cityId: snap.cityId,
    regionId: snap.regionId,
    content: snap.content,
    status: snap.status,
    publishedAtLocal: toLocalDatetimeValue(snap.publishedAt),
    scheduledAtLocal: toLocalDatetimeValue(snap.scheduledAt),
    seoTitle: snap.seoTitle,
    seoDescription: snap.seoDescription,
    seoCanonicalUrl: snap.seoCanonicalUrl,
    noindex: snap.noindex,
  });
}
