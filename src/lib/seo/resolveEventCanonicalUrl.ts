import { validateStoredCanonical } from "./validateStoredCanonical";

/**
 * Resolves the canonical URL for a publicly-visible Event (Activity) detail
 * page — `/{city}/events/{slug|id}`. A stored `seoCanonicalUrl` is only
 * trusted if it matches the exact expected path for the current
 * city/slug and current public origin; otherwise it falls back to the
 * deterministic path.
 */
export interface ResolveEventCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  citySlug: string;
  slug: string | null | undefined;
  id: string;
  publicBase: string;
}

export function resolveEventCanonicalUrl(input: ResolveEventCanonicalUrlInput): string {
  const seg = input.slug?.trim() || input.id;
  const expectedPath = `/${input.citySlug}/events/${seg}`;
  const fallback = `${input.publicBase.replace(/\/$/, "")}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}
