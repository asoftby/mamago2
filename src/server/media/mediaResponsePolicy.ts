export const PUBLIC_MEDIA_CACHE_CONTROL =
  "public, max-age=31536000, immutable";
export const PRIVATE_MEDIA_CACHE_CONTROL = "private, no-store";

export type MediaResponsePolicy =
  | { canServe: false }
  | { canServe: true; cacheControl: string };

/**
 * Translate the canonical access decisions into response cache semantics.
 * `publiclyServable` must come from canLoadMediaAnonymously(); authorization
 * alone may permit bytes, but must never make them shared-cacheable.
 */
export function decideMediaResponsePolicy(input: {
  publiclyServable: boolean;
  authorizedToServe: boolean;
}): MediaResponsePolicy {
  if (!input.authorizedToServe) {
    return { canServe: false };
  }

  return {
    canServe: true,
    cacheControl: input.publiclyServable
      ? PUBLIC_MEDIA_CACHE_CONTROL
      : PRIVATE_MEDIA_CACHE_CONTROL,
  };
}
