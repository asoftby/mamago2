import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Boost does not add a promotional badge to the business Event card", () => {
  const eventCard = read("src/components/business/events/EventCardHorizontal.tsx");
  assert.doesNotMatch(eventCard, />\s*Продвигается\s*</);
  assert.match(eventCard, /buildBusinessBoostHref\("EVENT", activity\.id\)/);
});

test("Boost ranking remains internal to Event and Offer discovery", () => {
  for (const path of [
    "src/server/discovery/kudaDiscoveryFeed.ts",
    "src/server/discovery/classesDiscoveryFeed.ts",
  ]) {
    const feed = read(path);
    assert.match(feed, /getPublicationBoostLevel/);
    assert.doesNotMatch(feed, /Партнёрская рекомендация|Реклама/);
  }
});

test("Partner story labeling remains separate from Boost", () => {
  const viewer = read("src/features/stories/components/StoryViewerCard.tsx");
  const modal = read("src/features/stories/components/StoryModalActionCard.tsx");
  assert.match(viewer, /item\.isPromoted/);
  assert.match(modal, /item\.isPromoted/);
});
