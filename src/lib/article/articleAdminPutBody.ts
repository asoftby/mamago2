import { z } from "zod";
import { ContentStatus, GeoScope } from "@prisma/client";
import {
  ArticleContentPayloadSchema,
  deriveArticleExcerptFromContent,
} from "@/lib/publications/articleMvp";
import type { ArticleSaveInput } from "@/lib/article/articleAdminTypes";

/** Тело PUT /api/admin/articles/[id] и POST /api/admin/articles — одна и та же форма. */
export const ArticleAdminPutBodySchema = z.object({
  title: z.string().min(1),
  slug: z.string().nullable(),
  subtitle: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  content: ArticleContentPayloadSchema,
  coverImageId: z.string().nullable(),
  authorLabel: z.string().nullable().optional(),
  authorUserId: z.string().nullable().optional(),
  cityContext: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  additionalCategoryIds: z.array(z.string()).optional(),
  geoScope: z.nativeEnum(GeoScope).nullable().optional(),
  cityId: z.string().nullable().optional(),
  regionId: z.string().nullable().optional(),
  status: z.nativeEnum(ContentStatus),
  publishedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoCanonicalUrl: z.string().nullable().optional(),
  seoOgTitle: z.string().nullable().optional(),
  seoOgDescription: z.string().nullable().optional(),
  seoRobots: z.string().nullable().optional(),
  noindex: z.boolean(),
  tagIds: z.array(z.string()).optional(),
});

export function articleSaveInputFromPutBody(
  data: z.infer<typeof ArticleAdminPutBodySchema>,
): ArticleSaveInput {
  return {
    title: data.title,
    slug: data.slug,
    subtitle: data.subtitle ?? null,
    excerpt: deriveArticleExcerptFromContent(data.content),
    content: data.content,
    coverImageId: data.coverImageId,
    authorLabel: data.authorLabel ?? null,
    authorUserId: data.authorUserId ?? null,
    cityContext: data.cityContext ?? null,
    categoryId: data.categoryId ?? null,
    additionalCategoryIds: data.additionalCategoryIds ?? [],
    geoScope: data.geoScope,
    cityId: data.cityId,
    regionId: data.regionId,
    status: data.status,
    publishedAt: data.publishedAt,
    scheduledAt: data.scheduledAt,
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    seoCanonicalUrl: data.seoCanonicalUrl ?? null,
    seoOgTitle: data.seoOgTitle ?? null,
    seoOgDescription: data.seoOgDescription ?? null,
    seoRobots: data.seoRobots ?? null,
    noindex: data.noindex,
    tagIds: data.tagIds,
  };
}
