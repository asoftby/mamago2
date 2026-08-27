import type { StoryCollection, StoryItem } from "../types/story";

const PUBLIC_STORY_ITEM_LIMIT = 5;

type PublicStoryPresentationOptions = {
  /** Public Today toggle. Internal `running` must never bypass it. */
  todayEnabled?: boolean;
  /** Canonical admin order by intent; merged Today is anchored to `today`. */
  orderByIntent?: Readonly<Record<string, number>>;
};

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

function isTemporal(collection: StoryCollection): boolean {
  return collection.intent === "today" || collection.intent === "running";
}

function fallbackInsertIndex(
  collections: readonly StoryCollection[],
  contextual: readonly StoryCollection[],
): number {
  const todayIndex = collections.findIndex((collection) => collection.intent === "today");
  const runningIndex = collections.findIndex((collection) => collection.intent === "running");
  const anchorIndex = todayIndex >= 0 ? todayIndex : runningIndex;
  if (anchorIndex < 0) return contextual.length;
  return collections.slice(0, anchorIndex).filter((collection) => !isTemporal(collection)).length;
}

/**
 * Public Stories presentation rules.
 *
 * - one temporal circle: «Сегодня»;
 * - point/occurrence Today items stay first; serial `running` items fill gaps;
 * - the public Today toggle controls the merged circle as a whole;
 * - merged Today is positioned by Today's admin order, never Running's order;
 * - merged Today keeps the existing 5-item public collection limit;
 * - legacy «Идёт сейчас» wording does not leak into the public viewer;
 * - contextual/editorial circles (`free`, `lastchance`, `breaking_news`)
 *   retain their canonical order and content.
 */
export function resolvePublicStoryPresentation(
  collections: readonly StoryCollection[],
  options: PublicStoryPresentationOptions = {},
): StoryCollection[] {
  const contextual = collections.filter((collection) => !isTemporal(collection));
  if (options.todayEnabled === false) return contextual;

  const today = collections.find((collection) => collection.intent === "today");
  const running = collections.find((collection) => collection.intent === "running");
  const runningTodayItems = running?.items.map(normalizeRunningTodayItem) ?? [];
  const todayItems = dedupeItems([...(today?.items ?? []), ...runningTodayItems]).slice(
    0,
    PUBLIC_STORY_ITEM_LIMIT,
  );

  if (todayItems.length === 0) return contextual;

  const replacement: StoryCollection = {
    ...(today ?? running!),
    id: "today",
    intent: "today",
    title: "Сегодня",
    emoji: "☀️",
    items: todayItems,
  };

  const configuredTodayOrder = options.orderByIntent?.today;
  const insertAt = configuredTodayOrder == null
    ? fallbackInsertIndex(collections, contextual)
    : (() => {
        const index = contextual.findIndex(
          (collection) => (options.orderByIntent?.[collection.intent] ?? Number.MAX_SAFE_INTEGER) > configuredTodayOrder,
        );
        return index >= 0 ? index : contextual.length;
      })();

  return [
    ...contextual.slice(0, insertAt),
    replacement,
    ...contextual.slice(insertAt),
  ];
}
