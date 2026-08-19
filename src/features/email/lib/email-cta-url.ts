import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

function joinWithCanonicalOrigin(pathname: string): string {
  const origin = getCanonicalPublicAppUrl();
  return `${origin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/**
 * Normalizes email CTA links so internal app paths always become absolute.
 * Non-http(s) schemes are rejected to avoid unsafe links in outbound email.
 */
export function resolveEmailCtaUrl(ctaUrl?: string | null): string | null {
  const trimmed = ctaUrl?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  return joinWithCanonicalOrigin(trimmed);
}
