import type { StoryCollection } from "../types/story";

/** Cover for the homepage story ring: promoted item first, else first item with an image. */
export function resolveStoryRingCoverUrl(story: StoryCollection): string | null {
  const promoted = story.items.find((item) => item.isPromoted && item.image?.trim());
  if (promoted?.image) return promoted.image.trim();
  const withImage = story.items.find((item) => item.image?.trim());
  return withImage?.image?.trim() ?? null;
}
