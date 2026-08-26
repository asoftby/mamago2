/**
 * Unit test for mergeMediaLibraryItems — the append-and-dedupe step used by
 * useMediaLibraryPager when an infinite-scroll page lands.
 *
 * Run: npx tsx src/components/media/useMediaLibraryPager.test.ts
 */
import assert from "node:assert/strict";
import { mergeMediaLibraryItems } from "./useMediaLibraryPager";

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

console.log("useMediaLibraryPager.test.ts: OK");
