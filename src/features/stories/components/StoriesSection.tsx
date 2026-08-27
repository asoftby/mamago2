import { StoryRings } from "./StoryRings";
import { resolvePublicStoryPresentation } from "../lib/resolvePublicStoryPresentation";
import { loadPublicStoryCollections } from "@/server/stories/loadPublicStoryCollections";
import { getPublicStoryIntentConfigs } from "@/server/stories/storyIntentConfig";

type StoriesSectionProps = { cityId: string; citySlug: string };

/** Public Stories 2.0: canonical rail data adapted to the public viewer UI. */
export async function StoriesSection({ cityId, citySlug }: StoriesSectionProps) {
  const [canonicalStories, configs] = await Promise.all([
    loadPublicStoryCollections({ cityId, citySlug }),
    getPublicStoryIntentConfigs(),
  ]);
  const todayConfig = configs.find((config) => config.intent === "today");
  const stories = resolvePublicStoryPresentation(canonicalStories, {
    todayEnabled: todayConfig?.enabled !== false,
    orderByIntent: Object.fromEntries(configs.map((config) => [config.intent, config.order])),
  });
  if (stories.length === 0) return null;
  return (
    <section aria-label="Stories">
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-1 pb-1" style={{ scrollbarWidth: "none" }}>
        <StoryRings stories={stories} />
      </div>
    </section>
  );
}
