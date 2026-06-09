import { articleStarterContent } from "@/lib/publications/articleMvp";
import {
  BREAKING_NEWS_SUBTITLE,
  emptyBreakingNewsContent,
} from "@/lib/publications/breakingNewsArticle";
import type { ArticleEditorSnapshot } from "@/lib/article/articleAdminTypes";

/** Редактор «новая статья» без записи в БД до первого сохранения. */
export function buildEmptyArticleEditorSnapshot(opts?: {
  defaultAuthorUserId?: string | null;
}): ArticleEditorSnapshot {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    slug: null,
    subtitle: null,
    excerpt: null,
    content: articleStarterContent(),
    heroImage: null,
    coverImageId: null,
    coverImageUrl: null,
    authorUserId: opts?.defaultAuthorUserId ?? null,
    authorLabel: null,
    cityContext: null,
    geoScope: null,
    cityId: null,
    status: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoOgImage: null,
    seoImageId: null,
    seoImageUrl: null,
    seoRobots: null,
    noindex: false,
    views: 0,
    updatedAt: now,
  };
}

/** Редактор «новая Breaking news» без записи в БД до первого сохранения. */
export function buildEmptyBreakingNewsEditorSnapshot(): ArticleEditorSnapshot {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    slug: null,
    subtitle: BREAKING_NEWS_SUBTITLE,
    excerpt: null,
    content: emptyBreakingNewsContent(),
    heroImage: null,
    coverImageId: null,
    coverImageUrl: null,
    authorUserId: null,
    authorLabel: null,
    cityContext: null,
    geoScope: null,
    cityId: null,
    status: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoOgImage: null,
    seoImageId: null,
    seoImageUrl: null,
    seoRobots: null,
    noindex: false,
    views: 0,
    updatedAt: now,
  };
}
