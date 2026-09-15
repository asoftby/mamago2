import assert from "node:assert/strict";

import { STORY_ACTIONS, resolveStoryActions } from "./story-actions";
import type { StoryItem, StoryItemType } from "../types/story";

// Mirrors the StoryItemType union in ../types/story.ts. TypeScript already
// enforces this (STORY_ACTIONS is a Record<StoryItemType, ...>, so a missing
// case fails `tsc`), this is the runtime companion check the task asked for.
const ALL_STORY_ITEM_TYPES: StoryItemType[] = [
  "story",
  "breaking-news",
  "event",
  "place",
  "offer",
  "route",
];

for (const type of ALL_STORY_ITEM_TYPES) {
  assert.ok(
    Array.isArray(STORY_ACTIONS[type]) && STORY_ACTIONS[type].length > 0,
    `STORY_ACTIONS is missing a registry entry for StoryItemType "${type}"`,
  );
}

assert.deepEqual(
  Object.keys(STORY_ACTIONS).sort(),
  [...ALL_STORY_ITEM_TYPES].sort(),
  "STORY_ACTIONS has a stale or extra key vs the StoryItemType union",
);

function baseItem(overrides: Partial<StoryItem> = {}): StoryItem {
  return {
    id: "i1",
    offerId: "i1",
    title: "Test item",
    image: "",
    type: "event",
    ...overrides,
  };
}

// No href → no actions, slot must not render.
assert.deepEqual(resolveStoryActions(baseItem({ href: null })), []);

// A single resolvable action is always forced to primary.
const single = resolveStoryActions(baseItem({ href: "/minsk/events/x" }));
assert.equal(single.length, 1);
assert.equal(single[0].variant, "primary");

// Unknown/missing type falls back to the generic "story" entry.
const fallback = resolveStoryActions(
  baseItem({ type: undefined, href: "/minsk" }),
);
assert.equal(fallback.length, 1);

console.log("story-actions tests: OK");
