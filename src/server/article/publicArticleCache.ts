import { revalidateTag } from "next/cache";

/**
 * Public journal list cache only. Article detail has additional dynamic
 * dependencies (embedded events/offers/places) and is intentionally excluded.
 */
export const PUBLIC_ARTICLE_LIST_CACHE_TAG = "public-articles:list";
export const PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS = 60 * 60;

/**
 * Invalidate every public article list projection. One global list tag is
 * deliberate: status/geography/category changes can move an article between
 * the national list and one or more city lists, so old/new membership is not
 * reliably represented by a single city tag.
 */
export function invalidatePublicArticleLists(): void {
  revalidateTag(PUBLIC_ARTICLE_LIST_CACHE_TAG, "max");
}
