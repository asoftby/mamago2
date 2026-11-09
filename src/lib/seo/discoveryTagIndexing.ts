/** Shared indexing gate used by tag metadata and sitemap. */
export const DISCOVERY_TAG_AUTO_INDEX_MIN_ARTICLES = 5;

export type DiscoveryTagIndexingPolicy = "AUTO" | "INDEX" | "NOINDEX";

/** Count only live, indexable articles relevant to the requested city. */
export function shouldIndexTagPage(mode: DiscoveryTagIndexingPolicy, eligibleCount: number): boolean {
  if (eligibleCount < 1 || mode === "NOINDEX") return false;
  if (mode === "INDEX") return true;
  return eligibleCount >= DISCOVERY_TAG_AUTO_INDEX_MIN_ARTICLES;
}
