import assert from "node:assert/strict";

import type { StoryItem } from "../types/story";
import {
  LEGACY_STORIES_SEEN_STORAGE_KEY,
  STORIES_SEEN_STORAGE_KEY,
  isSeen,
  markSeen,
  orderBySeen,
  readSeen,
  seenGroupStart,
  unseenCount,
  writeSeen,
} from "./seen";
import { resolveStoryRingCoverUrl } from "./resolveStoryRingCoverUrl";
import type { StoryCollection } from "../types/story";

const item = (id: string, offerId: string): StoryItem => ({
  id,
  offerId,
  title: id,
  image: "",
  type: "event",
});

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const storage = new MemoryStorage();
let seen = markSeen(new Set(), "offer-A");
writeSeen(storage, seen);
assert.deepEqual(JSON.parse(storage.getItem(STORIES_SEEN_STORAGE_KEY)!), {
  version: 2,
  offerIds: ["offer-A"],
});
assert.equal(markSeen(seen, "offer-A"), seen, "markSeen must be idempotent");

const occurrences = [item("occurrence-1", "offer-A"), item("occurrence-2", "offer-A")];
assert.equal(unseenCount(occurrences, seen), 0, "a new occurrence is not new content");
assert.equal(unseenCount([...occurrences, item("occurrence-3", "offer-B")], seen), 1);
assert.equal(unseenCount([item("x", "offer-C"), item("y", "offer-C")], seen), 1);
assert.equal(isSeen(item("tomorrow-occurrence", "offer-A"), seen), true);

const source = [item("s1", "offer-A"), item("u1", "offer-B"), item("s2", "offer-A"), item("u2", "offer-C")];
assert.deepEqual(orderBySeen(source, seen).map((value) => value.id), ["u1", "u2", "s1", "s2"]);
assert.equal(seenGroupStart(source, seen), 2);
assert.equal(seenGroupStart(source, new Set()), null);
assert.equal(seenGroupStart(source, new Set(["offer-A", "offer-B", "offer-C"])), null);

const bucket = (items: StoryItem[]): StoryCollection => ({
  id: "weekend",
  intent: "weekend",
  title: "на выходных",
  items,
});
const covers = bucket([
  { ...item("occurrence-A1", "offer-A"), image: "/poster-a.jpg" },
  { ...item("occurrence-B1", "offer-B"), image: "/poster-b.jpg" },
]);
assert.equal(resolveStoryRingCoverUrl(covers, new Set(["offer-A"])), "/poster-b.jpg");
assert.equal(
  resolveStoryRingCoverUrl(covers, new Set(["offer-A", "offer-B"])),
  "/poster-a.jpg",
  "all-seen bucket keeps the first source-order cover",
);
const withNewOffer = bucket([
  ...covers.items,
  { ...item("occurrence-C1", "offer-C"), image: "/poster-c.jpg" },
]);
assert.equal(resolveStoryRingCoverUrl(withNewOffer, new Set(["offer-A", "offer-B"])), "/poster-c.jpg");
const withNewOccurrence = bucket([
  ...covers.items,
  { ...item("occurrence-A2", "offer-A"), image: "/poster-a-new-occurrence.jpg" },
]);
assert.equal(
  resolveStoryRingCoverUrl(withNewOccurrence, new Set(["offer-A", "offer-B"])),
  "/poster-a.jpg",
  "a new occurrence of a seen offer does not replace the source-order cover",
);

seen = markSeen(seen, "offer-B");
assert.equal(unseenCount([item("a", "offer-A"), item("b", "offer-B"), item("c", "offer-C")], seen), 1);

const corrupt = new MemoryStorage();
corrupt.setItem(STORIES_SEEN_STORAGE_KEY, "{broken");
assert.deepEqual([...readSeen(corrupt)], []);

const legacy = new MemoryStorage();
legacy.setItem(LEGACY_STORIES_SEEN_STORAGE_KEY, JSON.stringify(["today"]));
assert.deepEqual([...readSeen(legacy)], []);
assert.equal(legacy.getItem(LEGACY_STORIES_SEEN_STORAGE_KEY), null);

console.log("stories seen tests: OK");
