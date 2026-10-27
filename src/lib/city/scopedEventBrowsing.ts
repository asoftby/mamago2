/** Events-only navigation to another city does not persist a global city selection. */
export const SCOPED_EVENT_BROWSE_PARAM = "explore";

export function isScopedEventBrowsing(pathname: string | null, explore: string | null): boolean {
  return explore === "1" && /^\/[a-z0-9-]+\/events\/?$/.test(pathname ?? "");
}

export function buildScopedEventHref(
  citySlug: string,
  listingSearchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(listingSearchParams)) {
    if (!value || ["city", "district", "metro", SCOPED_EVENT_BROWSE_PARAM].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
    else query.set(key, value);
  }
  query.set(SCOPED_EVENT_BROWSE_PARAM, "1");
  return `/${citySlug}/events?${query.toString()}`;
}
