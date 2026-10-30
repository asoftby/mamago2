/**
 * Routes whose URL is itself a secret (capability links). Third-party analytics
 * must never load there: both Yandex and Google read `location.href`.
 */
const CAPABILITY_PREFIXES = ["/w/"];

export function isCapabilityUrlPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return CAPABILITY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
