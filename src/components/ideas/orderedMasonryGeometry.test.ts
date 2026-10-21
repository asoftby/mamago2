import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getOrderedMasonryRowSpan } from "./orderedMasonryGeometry";

for (const height of [0, 1, 17, 90, 150.5, 280, 420, 1000]) {
  const span = getOrderedMasonryRowSpan(height, 8, 8);
  assert.ok(span >= 1);
  assert.ok(span * 8 + (span - 1) * 8 >= height, "Allocated rows must fit the card");
  if (span > 1) {
    assert.ok((span - 1) * 8 + (span - 2) * 8 < height, "Avoid unused extra rows");
  }
}
assert.equal(getOrderedMasonryRowSpan(160, 8, 8), 11);
assert.equal(getOrderedMasonryRowSpan(Number.NaN, 8, 8), 1);
assert.equal(getOrderedMasonryRowSpan(100, 0, 8), 1);

const layout = readFileSync(new URL("./OrderedMasonryGrid.tsx", import.meta.url), "utf8");
const collections = readFileSync(new URL("../../app/(public)/me/ideas/components/IdeasCollectionsBar.tsx", import.meta.url), "utf8");
const ideas = readFileSync(new URL("../../app/(public)/me/ideas/components/IdeasGrid.tsx", import.meta.url), "utf8");
assert.match(layout, /grid-flow-row/);
assert.doesNotMatch(layout, /grid-flow-dense|columns-2|grid-flow-col/);
assert.match(layout, /Children\.map\(children/);
assert.match(layout, /ResizeObserver/);
assert.match(layout, /gridRowEnd/);
assert.match(collections, /<OrderedMasonryGrid/);
assert.match(ideas, /<OrderedMasonryGrid/);
assert.doesNotMatch(ideas, /columns-2|break-inside-avoid/);
assert.match(collections, /key=\{item.id\}/);
assert.match(ideas, /key=\{idea.id\}/);

console.log("Ordered masonry geometry and row-major DOM-order contracts: OK");
