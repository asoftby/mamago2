import { validateStoredCanonical } from "./validateStoredCanonical";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";

/**
 * Resolves the canonical URL for a publicly-visible Article page.
 *
 * An Article is either COUNTRY-scoped (`/blog/{slug}`) or CITY-scoped
 * (`/{city}/blog/{slug}`) — the two live at different routes. A stored
 * `seoCanonicalUrl` is only trusted if it matches the exact expected path
 * for the article's own geoScope/city/slug and current public origin;
 * otherwise it falls back to the deterministic path, so a stale origin or a
 * canonical carried over from a scope change never gets rendered verbatim.
 */
export interface ResolveArticleCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  slug: string;
  geoScope?: "CITY" | "COUNTRY" | null;
  citySlug?: string | null;
  publicBase: string;
}

export function resolveArticleCanonicalUrl(input: ResolveArticleCanonicalUrlInput): string {
  const expectedPath = buildArticlePublicPath({
    slug: input.slug,
    geoScope: input.geoScope,
    citySlug: input.citySlug,
  });
  const fallback = `${input.publicBase.replace(/\/$/, "")}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}
