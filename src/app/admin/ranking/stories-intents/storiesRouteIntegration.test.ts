import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("src/app/admin/ranking/stories-intents/page.tsx");
const legacy = read("src/app/admin/content/stories/page.tsx");
const contentNav = read("src/lib/admin/contentSidebarConfig.ts");
const adminNav = read("src/lib/admin/adminSidebarConfig.ts");
const adminLayout = read("src/app/admin/layout.tsx");
const publicStories = read("src/features/stories/components/StoriesSection.tsx");
const rankingApi = read("src/server/services/ranking/adminRankingHandlers.ts");
const rulesPanel = read("src/app/admin/ranking/stories-intents/StoryIntentRulesPanel.tsx");
const homeStoryItems = read("src/server/stories/homeStoryItems.ts");

assert.match(page, /StoriesManagementPanel/, "ranking route contains placement management");
assert.match(page, /StoryIntentRulesPanel/, "existing intent rules remain available");
assert.match(page, /Состав Stories/);
assert.match(page, /Правила ранжирования/);
assert.match(legacy, /redirect\(`\/admin\/ranking\/stories-intents/, "legacy route redirects");
assert.doesNotMatch(contentNav, /content\/stories/, "Content has no competing navigation item");
assert.match(adminNav, /Stories на главной/);
assert.match(adminLayout, /user\.role !== "ADMIN" && user\.role !== "MODERATOR"/);
assert.match(publicStories, /listPublicHomeStoryItems/);
assert.doesNotMatch(publicStories, /loadEventsInRange/);
for (const key of ["today", "tomorrow", "weekend", "breaking_news", "free"]) assert.match(rankingApi, new RegExp(`intent: "${key}"`));
assert.doesNotMatch(rankingApi, /intent: "age_3_5"/);
assert.doesNotMatch(rankingApi, /intent: "new"/);
assert.match(publicStories, /getPublicStoryIntentConfigs/);
assert.doesNotMatch(rulesPanel, /Связь с главной/);
assert.doesNotMatch(rulesPanel, /binding/);
assert.match(rulesPanel, /Ближайшие бесплатные события/);
assert.match(publicStories, /listPublicFreeHomeStoryItems/);
assert.match(homeStoryItems, /sourceType: HomeStorySourceType\.EVENT/);
assert.match(homeStoryItems, /isFree: true/);
assert.match(homeStoryItems, /take: MAX_HOME_STORY_ITEMS_PER_INTENT/);
assert.doesNotMatch(publicStories, /prisma\.activity/);
assert.doesNotMatch(publicStories, /prisma\.offer/);

console.log("stories ranking route integration tests: OK");
