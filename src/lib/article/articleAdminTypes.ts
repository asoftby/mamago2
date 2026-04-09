import type { ContentStatus } from "@prisma/client";
import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

/** Снимок для редактора статьи (админ API и клиент без Prisma runtime). */
export type ArticleEditorSnapshot = {
  id: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  excerpt: string | null;
  content: ArticleContentPayload;
  heroImage: string | null;
  coverImageId: string | null;
  coverImageUrl: string | null;
  authorUserId: string | null;
  authorLabel: string | null;
  cityContext: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoOgImage: string | null;
  seoImageId: string | null;
  seoImageUrl: string | null;
  seoRobots: string | null;
  noindex: boolean;
  views: number;
  updatedAt: string;
};

export type ArticleSaveInput = {
  title: string;
  slug: string | null;
  subtitle: string | null;
  excerpt: string | null;
  content: ArticleContentPayload;
  coverImageId: string | null;
  authorLabel: string | null;
  authorUserId: string | null;
  cityContext: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoRobots: string | null;
  noindex: boolean;
};
