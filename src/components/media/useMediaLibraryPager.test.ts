/**
 * Unit tests for useMediaLibraryPager pure helpers.
 *
 * Run: npx tsx src/components/media/useMediaLibraryPager.test.ts
 */
import assert from "node:assert/strict";
import {
  MEDIA_LIBRARY_CLIENT_CACHE_TTL_MS,
  mergeMediaLibraryItems,
  shouldReuseMediaLibrarySnapshot,
} from "./useMediaLibraryPager";

type Item = { id: string; url: string };

function item(id: string): Item {
  return { id, url: `https://example.invalid/${id}` };
}

// Appending a fresh page keeps prior order and appends new items after.
assert.deepEqual(
  mergeMediaLibraryItems([item("a"), item("b")], [item("c"), item("d")]),
  [item("a"), item("b"), item("c"), item("d")],
);

// An id already present (e.g. a race re-delivering the same page) is skipped, not duplicated.
assert.deepEqual(
  mergeMediaLibraryItems([item("a"), item("b")], [item("b"), item("c")]),
  [item("a"), item("b"), item("c")],
);

// Selection-preservation scenario: items selected on page 1 stay first-class members
// of the merged list (same object identity) after page 2 lands — nothing overwrites them.
const page1 = [item("a"), item("b")];
const merged = mergeMediaLibraryItems(page1, [item("c")]);
assert.equal(merged[0], page1[0]);
assert.equal(merged[1], page1[1]);

// Empty next page is a no-op.
assert.deepEqual(mergeMediaLibraryItems([item("a")], []), [item("a")]);

// Empty prev page just adopts the next page verbatim.
assert.deepEqual(mergeMediaLibraryItems([], [item("a"), item("b")]), [item("a"), item("b")]);

const now = 1_000_000;

// Same owner + fresh snapshot + no invalidation: reopen must not hit the loader again.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-1",
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 2,
  }),
  true,
);

// Owner switch must never reuse another author's private media snapshot.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-2",
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 2,
  }),
  false,
);

// TTL expiry refreshes the first page so cross-tab changes eventually appear.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-1",
    loadedAt: now - MEDIA_LIBRARY_CLIENT_CACHE_TTL_MS,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 2,
  }),
  false,
);

// Explicit invalidation after upload forces the next open to refresh immediately.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "author-1",
    ownerKey: "author-1",
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 2,
    currentInvalidationVersion: 3,
  }),
  false,
);

// Null owner keys are normalized to the current-user picker scope.
assert.equal(
  shouldReuseMediaLibrarySnapshot({
    loadedOwnerKey: "__current-user__",
    ownerKey: null,
    loadedAt: now - 1_000,
    now,
    loadedInvalidationVersion: 0,
    currentInvalidationVersion: 0,
  }),
  true,
);

console.log("useMediaLibraryPager.test.ts: OK");
