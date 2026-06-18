import { absolutePublicImageUrl } from "@/lib/seo/schema/url";

export type BuildArticleJsonLdInput = {
  canonicalUrl: string;
  headline: string;
  description?: string | null;
  image?: string | null;
  datePublished?: Date | string | null;
  dateModified?: Date | string | null;
  authorName?: string | null;
  publisherName?: string | null;
  publisherLogoUrl?: string | null;
  articleSection?: string | null;
  keywords?: string[] | null;
  isNews?: boolean;
  publicBaseUrl?: string;
};

function normalizeDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeKeywords(value: string[] | null | undefined): string[] | undefined {
  if (!value || value.length === 0) return undefined;
  const cleaned = value.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function buildArticleJsonLd(input: BuildArticleJsonLdInput): Record<string, unknown> {
  const image = absolutePublicImageUrl(input.image, input.publicBaseUrl);
  const datePublished = normalizeDate(input.datePublished);
  const dateModified = normalizeDate(input.dateModified);
  const authorName = input.authorName?.trim() || undefined;
  const publisherName = input.publisherName?.trim() || undefined;
  const publisherLogo = absolutePublicImageUrl(input.publisherLogoUrl, input.publicBaseUrl);
  const articleSection = input.articleSection?.trim() || undefined;
  const keywords = normalizeKeywords(input.keywords);

  return {
    "@context": "https://schema.org",
    "@type": input.isNews ? "NewsArticle" : "BlogPosting",
    "@id": `${input.canonicalUrl}#article`,
    url: input.canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.canonicalUrl,
    },
    headline: input.headline,
    description: input.description?.trim() || undefined,
    image: image ? [image] : undefined,
    datePublished,
    dateModified,
    author: authorName
      ? {
          "@type": "Person",
          name: authorName,
        }
      : undefined,
    publisher: publisherName
      ? {
          "@type": "Organization",
          name: publisherName,
          logo: publisherLogo
            ? {
                "@type": "ImageObject",
                url: publisherLogo,
              }
            : undefined,
        }
      : undefined,
    articleSection,
    keywords,
  };
}
