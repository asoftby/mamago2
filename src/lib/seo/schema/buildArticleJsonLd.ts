import type { Article } from "@prisma/client";

export function buildArticleJsonLd(args: {
  article: Pick<Article, "slug" | "title" | "excerpt" | "heroImage" | "publishedAt">;
  publicBase: string;
}): Record<string, unknown> {
  const { article, publicBase } = args;
  const url = article.slug ? `${publicBase}/blog/${article.slug}` : undefined;
  const image = article.heroImage ?? undefined;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: article.publishedAt?.toISOString(),
    image: image ? [image] : undefined,
    url,
  };
}

