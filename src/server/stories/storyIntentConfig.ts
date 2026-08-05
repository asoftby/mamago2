import "server-only";

import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

export const STORY_INTENTS_CACHE_TAG = "story-intents:public:v1";
export const PUBLIC_STORY_INTENT_KEYS = ["today", "tomorrow", "weekend", "breaking_news", "free"] as const;

export const getPublicStoryIntentConfigs = unstable_cache(
  () => prisma.storyIntentConfig.findMany({
    where: { intent: { in: [...PUBLIC_STORY_INTENT_KEYS] } },
    select: { intent: true, title: true, enabled: true, order: true },
    orderBy: { order: "asc" },
  }),
  [STORY_INTENTS_CACHE_TAG],
  { tags: [STORY_INTENTS_CACHE_TAG], revalidate: 300 },
);
