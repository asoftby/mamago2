import type { StoryCollection, StoryItem } from "../types/story";

/**
 * `running` is an internal serial-program source, not a public navigation
 * concept. On the homepage it is folded into the single «Сегодня» circle,
 * but only when the representative occurrence is actually today / in progress.
 * Future serial programs stay out of the temporal circle instead of making
 * «Идёт сейчас» mean «sometime in the next two weeks».
 */
function runningItemBelongsToday(item: StoryItem): boolean {
  const eyebrow = item.eyebrow?.trim().toLocaleLowerCase("ru-RU") ?? "";
  return (
    eyebrow === "сегодня" ||
    eyebrow.startsWith("сегодня ·") ||
    eyebrow === "идёт сейчас" ||
    eyebrow.startsWith("идёт сейчас ·")
  );
}

function dedupeItems(items: readonly StoryItem[]): StoryItem[] {
  const seen = new Set<string>();
  const result: StoryItem[] = [];
  for (const item of items) {
    if (seen.has(item.offerId)) continue;
    seen.add(item.offerId);
    result.push(item);
  }
  return result;
}

/**
 * Public Stories presentation rules.
 *
 * - one temporal circle: «Сегодня»;
 * - serial `running` inventory relevant to today is merged into it;
 * - future serial inventory is not exposed as «Идёт сейчас»;
 * - contextual/editorial circles (`free`, `lastchance`, `breaking_news`)
 *   retain their canonical order and content.
 */
export function resolvePublicStoryPresentation(
  collections: readonly StoryCollection[],
): StoryCollection[] {
  const today = collections.find((collection) => collection.intent === "today");
  const running = collections.find((collection) => collection.intent === "running");
  const runningTodayItems = running?.items.filter(runningItemBelongsToday) ?? [];
  const todayItems = dedupeItems([...(today?.items ?? []), ...runningTodayItems]);

  const temporalIndexes = collections
    .map((collection, index) => ({ collection, index }))
    .filter(({ collection }) => collection.intent === "today" || collection.intent === "running")
    .map(({ index }) => index);
  const insertAt = temporalIndexes.length > 0 ? Math.min(...temporalIndexes) : -1;

  const replacement: StoryCollection | null = todayItems.length > 0
    ? {
        ...(today ?? running!),
        id: "today",
        intent: "today",
        title: "Сегодня",
        emoji: "☀️",
        items: todayItems,
      }
    : null;

  const result: StoryCollection[] = [];
  for (let index = 0; index < collections.length; index++) {
    if (index === insertAt && replacement) result.push(replacement);
    const collection = collections[index]!;
    if (collection.intent === "today" || collection.intent === "running") continue;
    result.push(collection);
  }

  return result;
}
