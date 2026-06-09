/**
 * SEO helpers for Breaking News articles.
 * Pure functions — no React, no side effects.
 */

import { buildNationalArticlePath } from "@/lib/routing/cityPaths";

export const SEO_TITLE_LIMIT = 60;
export const SEO_DESC_LIMIT = 160;

const SITE_NAME = "mamaGo";
const SITE_SUFFIX = ` — ${SITE_NAME}`;

// ─── Text utilities ───────────────────────────────────────────────────────────

/** Strip HTML tags and normalise whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate `text` to at most `limit` characters, cutting at the last space
 * before the limit so words are never split. Appends "…" when truncated.
 */
export function truncateSeoText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(" ", limit - 1);
  const trimmed = cut > 0 ? text.slice(0, cut) : text.slice(0, limit - 1);
  return trimmed.trimEnd() + "…";
}

// ─── Auto-generators ─────────────────────────────────────────────────────────

/**
 * Auto-generate SEO title from article title + optional city name.
 *
 * Format: "{title} в {city} — mamaGo"  or  "{title} — mamaGo"
 * Truncated to SEO_TITLE_LIMIT if needed.
 */
export function generateBreakingNewsSeoTitle(
  title: string,
  cityName?: string,
): string {
  const base = title.trim();
  if (!base) return "";

  const city = cityName?.trim();
  const suffix = city ? ` в ${city}${SITE_SUFFIX}` : SITE_SUFFIX;
  return truncateSeoText(base + suffix, SEO_TITLE_LIMIT);
}

/**
 * Auto-generate SEO description from article body HTML.
 *
 * Strips tags, appends a call-to-action, truncates to SEO_DESC_LIMIT.
 * Falls back to title-based description when body is empty.
 */
export function generateBreakingNewsSeoDescription(
  bodyHtml: string,
  fallbackTitle?: string,
): string {
  const plain = stripHtml(bodyHtml);

  const base = plain || fallbackTitle?.trim() || "";
  if (!base) return "";

  const withCta = `${base}. Подробности для родителей на ${SITE_NAME}.`;
  return truncateSeoText(withCta, SEO_DESC_LIMIT);
}

/**
 * Build the canonical URL for a Breaking News article.
 *
 * Pattern: {publicBaseUrl}/blog/{slug}
 * Returns empty string when slug is not yet available.
 */
export function buildBreakingNewsCanonicalUrl(
  slug: string,
  publicBaseUrl: string,
): string {
  const s = slug.trim();
  if (!s) return "";
  return `${publicBaseUrl.replace(/\/+$/, "")}${buildNationalArticlePath(s)}`;
}
