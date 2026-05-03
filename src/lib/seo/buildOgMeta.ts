import type { Metadata } from "next";

const FALLBACK_IMAGE = "https://mamago.by/og-default.jpg";
const SITE_NAME = "mamaGo";

/**
 * Strips HTML tags and truncates to maxLen characters.
 */
function stripHtml(html: string, maxLen = 160): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Ensures an image URL is absolute (starts with https://).
 * Relative paths are prefixed with the public base URL.
 */
function toAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mamago.by";
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export interface BuildOgMetaOptions {
  title: string;
  /** Plain-text description. If omitted, descriptionHtml is used as fallback. */
  description?: string | null;
  /** HTML description — stripped and truncated when description is absent. */
  descriptionHtml?: string | null;
  /** Cover image URL (absolute or relative). Falls back to FALLBACK_IMAGE. */
  image?: string | null;
  /** Canonical page URL (absolute). */
  url: string;
  /** Override robots directive. Defaults to index + follow. */
  robots?: Metadata["robots"];
}

/**
 * Builds a unified Next.js Metadata object with OpenGraph + Twitter cards.
 *
 * Usage:
 * ```ts
 * return buildOgMeta({
 *   title: entity.title,
 *   description: entity.shortDesc,
 *   image: entity.coverImageUrl,
 *   url: `https://mamago.by/minsk/events/${entity.slug}`,
 * });
 * ```
 */
export function buildOgMeta({
  title,
  description,
  descriptionHtml,
  image,
  url,
  robots,
}: BuildOgMetaOptions): Metadata {
  // Resolve description: explicit > stripped HTML > undefined
  const resolvedDescription =
    description?.trim() ||
    (descriptionHtml ? stripHtml(descriptionHtml) : undefined) ||
    undefined;

  // Resolve image: provided > fallback
  const resolvedImage = toAbsoluteUrl(image) ?? FALLBACK_IMAGE;

  return {
    title,
    description: resolvedDescription,
    robots: robots ?? { index: true, follow: true },
    openGraph: {
      title,
      description: resolvedDescription,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: resolvedImage,
          width: 1200,
          height: 630,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: resolvedDescription,
      images: [resolvedImage],
    },
  };
}
