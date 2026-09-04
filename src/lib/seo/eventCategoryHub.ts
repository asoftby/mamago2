export function eventCategoryHubPath(citySlug: string, categorySlug: string): string {
  return `/${citySlug}/events/category/${categorySlug}`;
}

/**
 * Traffic-prioritized WordPress category hubs that previously collapsed into
 * the generic /minsk/events listing. Keep this small and evidence-based: each
 * override must preserve a known historical search intent with a real active
 * event category on the new site.
 */
export const LEGACY_EVENT_CATEGORY_HUB_OVERRIDES: Readonly<Record<string, string>> = {
  "/master-klassy-dlya-detej": eventCategoryHubPath("minsk", "workshops"),
  "/detskie-spektakli": eventCategoryHubPath("minsk", "theatre"),
};

export function resolveLegacySeoDestination(source: string, manifestDestination: string): string {
  return LEGACY_EVENT_CATEGORY_HUB_OVERRIDES[source] ?? manifestDestination;
}
