/** Cache tags shared by the event editor and taxonomy mutation routes. */
export const EVENT_STEP1_CATEGORIES_TAG = "event-step1-categories";
export const EVENT_STEP1_AGES_TAG = "event-step1-ages";
export const EVENT_STEP1_INTERESTS_TAG = "event-step1-interests";
export const eventStep1GenresTag = (categoryId: string) => `event-step1-genres:${categoryId}`;

/** Only these signal definitions feed the event editor's cached option lists. */
export function eventStep1SignalCacheTags(...slugs: Array<string | null | undefined>): string[] {
  const tags: Array<string | null> = slugs.map((slug) => {
    if (slug === "age") return EVENT_STEP1_AGES_TAG;
    if (slug === "interests") return EVENT_STEP1_INTERESTS_TAG;
    return null;
  });
  return [...new Set(tags.filter((tag): tag is string => tag !== null))];
}
