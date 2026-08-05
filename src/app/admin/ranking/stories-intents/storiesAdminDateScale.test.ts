import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pluralizeStories } from "./storiesAdminDateScale";

assert.equal(pluralizeStories(0), "0 историй");
assert.equal(pluralizeStories(1), "1 история");
assert.equal(pluralizeStories(2), "2 истории");
assert.equal(pluralizeStories(5), "5 историй");
assert.equal(pluralizeStories(11), "11 историй");
assert.equal(pluralizeStories(21), "21 история");

const panel = readFileSync("src/app/admin/ranking/stories-intents/StoriesManagementPanel.tsx", "utf8");
assert.match(panel, /city\.slug === "minsk"/, "Minsk uses canonical slug fallback");
assert.match(panel, /query\.cityId/, "valid URL city has priority");
assert.match(panel, /AdminStoryDateScale/, "shared plan calendar is used");
assert.match(panel, /groupBy\(\{/, "range counters use one aggregate query");
assert.match(panel, /storyDate: \{ gte: weekRange\.start, lt: weekRange\.end \}/);
assert.doesNotMatch(panel, /Мобильный предпросмотр/);
assert.doesNotMatch(panel, /scheduleJson/);

console.log("stories admin date scale tests: OK");
