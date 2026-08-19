import type { GeoScope } from "@prisma/client";
import type { ArticleMvpResolvedBlock } from "@/lib/article/articleMvpRenderData";
import type {
  NextArticleSectionRef,
  PublicContinuousArticleDto,
} from "@/lib/article/nextArticleInSection";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";

/** Собирает seed для ContinuousArticleReader из результата loadArticleMvpBySlugPublic. */
export function buildContinuousArticleSeed(args: {
  id: string;
  title: string;
  excerpt: string | null;
  subtitle: string | null;
  slug: string;
  publishedAt: Date | null;
  heroUrl: string | null;
  heroAlt?: string | null;
  blocks: ArticleMvpResolvedBlock[];
  categoryLabel: string | null;
  tags: Array<{ slug: string; title: string }>;
  section: NextArticleSectionRef | null;
  geoScope: GeoScope;
  cityId: string | null;
  citySlug: string | null;
  documentTitle?: string;
  readTimeMinutes?: number;
}): PublicContinuousArticleDto {
  const href = buildArticlePublicPath({
    slug: args.slug,
    geoScope: args.geoScope,
    citySlug: args.citySlug,
  });
  return {
    id: args.id,
    slug: args.slug,
    href,
    title: args.title,
    excerpt: args.excerpt,
    subtitle: args.subtitle,
    publishedAt: args.publishedAt ? args.publishedAt.toISOString() : null,
    documentTitle: args.documentTitle?.trim() || `${args.title} — mamaGo`,
    heroUrl: args.heroUrl,
    heroAlt: args.heroAlt ?? args.title,
    readTimeMinutes: args.readTimeMinutes ?? 5,
    categoryLabel: args.categoryLabel,
    section: args.section,
    tags: args.tags,
    blocks: args.blocks,
    geoScope: args.geoScope,
    cityId: args.cityId,
  };
}
