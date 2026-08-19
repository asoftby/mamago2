import type { StoryCollection } from "../types/story";
import { orderBySeen } from "./seen";

/** The first unseen offer is the ring cover; all-seen stories retain their source-order cover. */
export function resolveStoryRingCoverUrl(
  story: StoryCollection,
  seenOfferIds: ReadonlySet<string>,
): string | null {
  const selected = orderBySeen(story.items, seenOfferIds).find((item) => item.image?.trim());
  return selected?.image.trim() || null;
}
