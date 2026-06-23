import { sanitizeReturnTo } from "@/lib/backoffice/saveFlow";

export const PLACE_DETAIL_FALLBACK_HREF = "/admin/content/places";

export function getPlaceDetailHref(placeId: string, returnTo?: string | null): string {
  const href = `/admin/content/places/${placeId}`;
  if (!returnTo?.trim()) return href;
  return `${href}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getPlaceDetailBackLink(
  returnTo: string | null | undefined,
): { href: string; label: string } {
  const href = sanitizeReturnTo(returnTo, PLACE_DETAIL_FALLBACK_HREF);

  if (
    href.startsWith("/admin/moderation/queue") ||
    href.startsWith("/admin/moderation/places")
  ) {
    return { href, label: "Назад к очереди" };
  }

  if (href.startsWith("/admin/content/places")) {
    return { href, label: "Назад к местам" };
  }

  if (href !== PLACE_DETAIL_FALLBACK_HREF) {
    return { href, label: "Назад" };
  }

  return { href: PLACE_DETAIL_FALLBACK_HREF, label: "Назад к местам" };
}
