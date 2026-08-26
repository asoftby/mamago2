export interface NeutralImportedMediaIdentity {
  seedFilename: string;
  originalName: string;
  title: string;
}

function normalizedHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

/**
 * Tokens that must never appear in public-facing metadata generated from a
 * remote import source. These are intentionally derived from the source URL
 * only for validation; they are never persisted or returned to the client.
 */
export function importSourceLeakTokens(sourceUrl: URL): string[] {
  const host = normalizedHost(sourceUrl.hostname);
  const dashed = host.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const compact = host.replace(/[^a-z0-9]+/g, "");

  return [...new Set([host, dashed, compact].filter((token) => token.length >= 3))];
}

export function containsImportSourceLeak(
  value: string | null | undefined,
  sourceUrl: URL,
): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return importSourceLeakTokens(sourceUrl).some((token) => normalized.includes(token));
}

/**
 * Public identity for a remotely imported image.
 *
 * Critical privacy/provenance boundary:
 * - the source URL/hostname may be used internally to download and diagnose;
 * - it must not influence the public filename, originalName, title or API URL.
 */
export function buildNeutralImportedMediaIdentity(
  sourceUrl: URL,
): NeutralImportedMediaIdentity {
  const identity: NeutralImportedMediaIdentity = {
    seedFilename: "media.jpg",
    originalName: "media.webp",
    title: "Media",
  };

  for (const value of Object.values(identity)) {
    if (containsImportSourceLeak(value, sourceUrl)) {
      throw new Error("Imported media identity contains source information");
    }
  }

  return identity;
}
