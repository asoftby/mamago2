import type { StoryItem } from "../types/story";

export const STORIES_SEEN_STORAGE_KEY = "mamago.stories.seen.v2";
export const LEGACY_STORIES_SEEN_STORAGE_KEY = "mamago.stories.seen";
export const STORIES_SEEN_STORAGE_VERSION = 2;

type SeenState = {
  version: typeof STORIES_SEEN_STORAGE_VERSION;
  offerIds: string[];
};

export type StoriesStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readSeen(storage: StoriesStorage | null): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(STORIES_SEEN_STORAGE_KEY);
    if (!raw) {
      // The legacy array contains story/occurrence ids and cannot be mapped safely.
      storage.removeItem(LEGACY_STORIES_SEEN_STORAGE_KEY);
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Partial<SeenState>).version !== STORIES_SEEN_STORAGE_VERSION ||
      !Array.isArray((parsed as Partial<SeenState>).offerIds)
    ) {
      return new Set();
    }
    return new Set(
      (parsed as SeenState).offerIds.filter(
        (offerId): offerId is string => typeof offerId === "string" && offerId.length > 0,
      ),
    );
  } catch {
    return new Set();
  }
}

export function writeSeen(storage: StoriesStorage | null, seenOfferIds: Set<string>): void {
  if (!storage) return;
  const state: SeenState = {
    version: STORIES_SEEN_STORAGE_VERSION,
    offerIds: [...seenOfferIds],
  };
  try {
    storage.setItem(STORIES_SEEN_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function isSeen(item: StoryItem, seenOfferIds: ReadonlySet<string>): boolean {
  return seenOfferIds.has(item.offerId);
}

export function markSeen(seenOfferIds: ReadonlySet<string>, offerId: string): Set<string> {
  if (!offerId || seenOfferIds.has(offerId)) return seenOfferIds as Set<string>;
  const next = new Set(seenOfferIds);
  next.add(offerId);
  return next;
}

export function unseenCount(items: readonly StoryItem[], seenOfferIds: ReadonlySet<string>): number {
  const unseenOfferIds = new Set<string>();
  for (const item of items) {
    if (!isSeen(item, seenOfferIds)) unseenOfferIds.add(item.offerId);
  }
  return unseenOfferIds.size;
}

/** Stable partition: unseen first, preserving source order inside both groups. */
export function orderBySeen(
  items: readonly StoryItem[],
  seenOfferIds: ReadonlySet<string>,
): StoryItem[] {
  const unseen: StoryItem[] = [];
  const seen: StoryItem[] = [];
  for (const item of items) (isSeen(item, seenOfferIds) ? seen : unseen).push(item);
  return [...unseen, ...seen];
}

export function seenGroupStart(
  items: readonly StoryItem[],
  seenOfferIds: ReadonlySet<string>,
): number | null {
  const unseenItems = items.filter((item) => !isSeen(item, seenOfferIds)).length;
  return unseenItems > 0 && unseenItems < items.length ? unseenItems : null;
}

/** Breaking News shares a single seen state between the Journal and the homepage story entry. */
export const BREAKING_NEWS_SEEN_STORAGE_KEY = "mamago.breaking-news.seen.v1";

export function readSeenBreakingNews(storage: StoriesStorage | null): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(BREAKING_NEWS_SEEN_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0) : []);
  } catch { return new Set(); }
}

export function markBreakingNewsSeen(storage: StoriesStorage | null, articleId: string): void {
  if (!storage || !articleId) return;
  const next = readSeenBreakingNews(storage);
  next.add(articleId);
  try { storage.setItem(BREAKING_NEWS_SEEN_STORAGE_KEY, JSON.stringify([...next])); } catch {}
}

export function orderBreakingNewsBySeen<T extends { id: string }>(items: readonly T[], seenIds: ReadonlySet<string>): T[] {
  return [...items.filter((item) => !seenIds.has(item.id)), ...items.filter((item) => seenIds.has(item.id))];
}
