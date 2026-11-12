import type { ActivityMock } from "@/types/activity";

/** One-shot recovery only after a personalized request has actually failed.
 * Normal HOME loads do not download the public catalog or run a second ranking.
 */
export async function loadHomePublicFallback(
  citySlug: string,
  fetcher: typeof fetch = fetch,
): Promise<ActivityMock[] | null> {
  try {
    const response = await fetcher(
      `/api/discovery/events/page?listingCity=${encodeURIComponent(citySlug)}&page=1`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("items" in payload) ||
        !Array.isArray(payload.items)) return null;
    const cards = payload.items.filter((item): item is ActivityMock =>
      item !== null && typeof item === "object"
      && typeof item.id === "string" && typeof item.title === "string"
      && (typeof item.slug === "string" || typeof item.href === "string"));
    return cards.slice(0, 10);
  } catch {
    return null;
  }
}
