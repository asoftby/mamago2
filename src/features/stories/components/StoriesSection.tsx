import { StoryRings } from "./StoryRings";
import { resolvePublicStoryPresentation } from "../lib/resolvePublicStoryPresentation";
import { loadPublicStoryCollections } from "@/server/stories/loadPublicStoryCollections";

type StoriesSectionProps = { cityId: string; citySlug: string };

/** Public Stories 2.0: canonical rail data adapted to the public viewer UI. */
export async function StoriesSection({ cityId, citySlug }: StoriesSectionProps) {
  const canonicalStories = await loadPublicStoryCollections({ cityId, citySlug });
  const stories = resolvePublicStoryPresentation(canonicalStories);
  if (stories.length === 0) return null;
  return (
    <section aria-label="Stories">
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-1 pb-1" style={{ scrollbarWidth: "none" }}>
        <StoryRings stories={stories} />
      </div>
    </section>
  );
}
