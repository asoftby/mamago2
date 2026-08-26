import type { StoryCollection, StoryItem } from "../types/story";

/**
 * `running` is an internal serial-program source, not a public navigation
 * concept. Its registry range is the current city day, so every item from that
 * source is folded into the single public «Сегодня» circle.
 */
function normalizeRunningTodayItem(item: StoryItem): StoryItem {
  return {
    ...item,
    // Public temporal language is intentionally calendar-based. The technical
    // `running` source must not leak its legacy «Идёт сейчас» label into UI.
    eyebrow: "сегодня",
  };
}

function dedupeItems(items: readonly StoryItem[]): StoryItem[] {
  const seen = new Set<string>();
  const result: StoryItem[] = [];
  for (const item of items) {
    // Keep distinct occurrences of the same Activity. `offerId` is the stable
    // seen-state identity and is intentionally shared by those occurrences.
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

/**
 * Public Stories presentation rules.
 *
 * - one temporal circle: «Сегодня»;
 * - serial `running` inventory is merged into it;
 * - legacy «Идёт сейчас» wording does not leak into the public viewer;
 * - contextual/editorial circles (`free`, `lastchance`, `breaking_news`)
 *   retain their canonical order and content.
 */
export function resolvePublicStoryPresentation(
  collections: readonly StoryCollection[],
): StoryCollection[] {
  const today = collections.find((collection) => collection.intent === "today");
  const running = collections.find((collection) => collection.intent === "running");
  const runningTodayItems = running?.items.map(normalizeRunningTodayItem) ?? [];
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
