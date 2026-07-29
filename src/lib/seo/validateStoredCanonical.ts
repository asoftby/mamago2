/**
 * Shared validation for a stored `seoCanonicalUrl` value before it is trusted
 * at read-time. Generalizes the inline check that already existed in
 * `resolveRouteCanonicalUrl` so Place/Offer/Article/Event can share it.
 *
 * A stored canonical is only trusted if it is syntactically valid, uses the
 * current public origin (rejects stale hosts like `mamago.local:3000` once
 * the origin changes), and points at the exact expected path for the entity
 * (rejects wrong slug/city/section, redirect-source paths, query and hash).
 * Anything else falls back to the caller-supplied deterministic path.
 */
export interface ValidateStoredCanonicalInput {
  stored: string | null | undefined;
  publicBase: string;
  expectedPath: string;
}

export function validateStoredCanonical(input: ValidateStoredCanonicalInput): string | null {
  const stored = input.stored?.trim();
  if (!stored) return null;

  try {
    const url = new URL(stored);
    const publicOrigin = new URL(input.publicBase).origin;
    const expectedPath = input.expectedPath.replace(/\/$/, "") || "/";
    const actualPath = url.pathname.replace(/\/$/, "") || "/";

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === publicOrigin &&
      actualPath === expectedPath &&
      !url.search &&
      !url.hash
    ) {
      return url.toString();
    }
  } catch {
    // Invalid stored metadata must not prevent the deterministic fallback.
  }

  return null;
}
