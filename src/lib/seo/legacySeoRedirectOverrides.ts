import { resolveLegacySeoDestination as resolveEventCategoryLegacyDestination } from "./eventCategoryHub";

const LEGACY_ARTICLE_REDIRECT_OVERRIDES: Readonly<Record<string, string>> = {
  "/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome":
    "/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
};

/**
 * Traffic- and evidence-prioritized corrections layered over the historical
 * migration manifest. The manifest remains the broad source of truth; this
 * function only repairs confirmed cases where its destination loses the
 * original search intent or assigns the wrong geography.
 */
export function resolveLegacySeoDestination(source: string, manifestDestination: string): string {
  const categoryDestination = resolveEventCategoryLegacyDestination(source, manifestDestination);
  if (categoryDestination !== manifestDestination) return categoryDestination;
  return LEGACY_ARTICLE_REDIRECT_OVERRIDES[source] ?? manifestDestination;
}
