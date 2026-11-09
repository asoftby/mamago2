import { addDateKeyDays, weekdayFromDateKey } from "@/lib/stories/ranges";
import { todayKeyIn } from "@/features/filters/discovery/quickFilterPresets";

export type ArticleAfishaPeriod = "ALL" | "WEEK" | "WEEKEND";

/**
 * Only supplies standard «Куда пойти» URL filters.
 * The actual event selection, date interpretation, scoring and paid Boost
 * remain in loadKudaListingPage -> buildKudaEventFilters -> getKudaDiscoveryFeed.
 *
 * WEEK is the rest of the current Monday–Sunday week in Europe/Minsk;
 * WEEKEND is the catalog's own rolling «Выходные» preset.
 */
export function articleDynamicAfishaParams(
  input: { period?: ArticleAfishaPeriod; occasionSlug?: string | null },
  now: Date = new Date(),
): URLSearchParams {
  const params = new URLSearchParams();
  if (input.occasionSlug) params.set("occasion", input.occasionSlug);

  if (input.period === "WEEKEND") {
    params.set("preset", "weekend");
  } else if (input.period === "WEEK") {
    const today = todayKeyIn(now);
    const weekday = weekdayFromDateKey(today);
    const daysToSunday = (7 - weekday) % 7;
    params.set("from", today);
    params.set("to", addDateKeyDays(today, daysToSunday));
  }
  return params;
}
