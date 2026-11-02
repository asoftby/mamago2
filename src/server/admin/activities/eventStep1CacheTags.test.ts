import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EVENT_STEP1_AGES_TAG,
  EVENT_STEP1_CATEGORIES_TAG,
  EVENT_STEP1_INTERESTS_TAG,
  eventStep1GenresTag,
  eventStep1SignalCacheTags,
} from "./eventStep1CacheTags";

test("interests and age definitions invalidate their own event editor option lists", () => {
  assert.deepEqual(eventStep1SignalCacheTags("interests"), [EVENT_STEP1_INTERESTS_TAG]);
  assert.deepEqual(eventStep1SignalCacheTags("age"), [EVENT_STEP1_AGES_TAG]);
  assert.deepEqual(eventStep1SignalCacheTags("format", "other", null), []);
});

test("renaming a signal invalidates old and new tags once", () => {
  assert.deepEqual(eventStep1SignalCacheTags("interests", "age", "interests"), [
    EVENT_STEP1_INTERESTS_TAG,
    EVENT_STEP1_AGES_TAG,
  ]);
});

test("event categories and genres use separate cache tags", () => {
  assert.equal(EVENT_STEP1_CATEGORIES_TAG, "event-step1-categories");
  assert.equal(eventStep1GenresTag("category-1"), "event-step1-genres:category-1");
});
