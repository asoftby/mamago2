import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getOrderedMasonryRowSpan,
  layoutMasonry,
  masonryColumnWidth,
  masonryColumnsForWidth,
  SSR_MASONRY_CONFIG,
} from "./orderedMasonryGeometry";

// Legacy helper kept.
assert.equal(getOrderedMasonryRowSpan(160, 8, 8), 11);
assert.equal(getOrderedMasonryRowSpan(Number.NaN, 8, 8), 1);

// Breakpoints: <640 → 2/12, 640–1024 → 3/16, >1024 → 4/20.
assert.deepEqual(masonryColumnsForWidth(390), { columns: 2, gap: 12 });
assert.deepEqual(masonryColumnsForWidth(639), { columns: 2, gap: 12 });
assert.deepEqual(masonryColumnsForWidth(640), { columns: 3, gap: 16 });
assert.deepEqual(masonryColumnsForWidth(1024), { columns: 3, gap: 16 });
assert.deepEqual(masonryColumnsForWidth(1025), { columns: 4, gap: 20 });
assert.deepEqual(SSR_MASONRY_CONFIG, { columns: 2, gap: 12 });
assert.equal(masonryColumnWidth(358, { columns: 2, gap: 12 }), 173);

const cfg = { columns: 2, gap: 12, columnWidth: 100 };
const item = (key: string, ratio: number) => ({ key, ratio, textHeight: 50 });

// Shortest column, feed order, ties → leftmost.
const first = layoutMasonry([item("a", 1.5), item("b", 0.5625), item("c", 1), item("d", 1)], cfg);
assert.deepEqual(first.columnKeys, [["a", "d"], ["b", "c"]]);
// a=200, b=106.25 → c goes right (106 < 200) → right=106.25+12+150=268.25 → d goes left.

// Determinism.
assert.deepEqual(layoutMasonry([item("a", 1.5), item("b", 0.5625), item("c", 1), item("d", 1)], cfg).columnKeys, first.columnKeys);

// Append stability: shown items keep columns even if heights changed (text measured later).
const appended = layoutMasonry(
  [{ key: "a", ratio: 1.5, textHeight: 400 }, item("b", 0.5625), item("c", 1), item("d", 1), item("e", 1), item("f", 1.2)],
  cfg,
  first,
);
for (const key of ["a", "b", "c", "d"]) assert.equal(appended.assignment.get(key), first.assignment.get(key));
assert.equal(appended.columnKeys[0]!.slice(0, 2).join(), "a,d");
assert.equal(appended.columnKeys[1]!.slice(0, 2).join(), "b,c");
// Within each column, order still follows the feed order.
for (const keys of appended.columnKeys) {
  const order = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual([...keys].sort((x, y) => order.indexOf(x) - order.indexOf(y)), keys);
}

// Column count change → full re-layout (previous ignored).
const three = layoutMasonry([item("a", 1), item("b", 1), item("c", 1)], { columns: 3, gap: 16, columnWidth: 100 }, first);
assert.deepEqual(three.columnKeys, [["a"], ["b"], ["c"]]);

// Source contracts.
const grid = readFileSync(new URL("./OrderedMasonryGrid.tsx", import.meta.url), "utf8");
const ideas = readFileSync(new URL("../../app/(public)/me/ideas/components/IdeasGrid.tsx", import.meta.url), "utf8");
const collections = readFileSync(new URL("../../app/(public)/me/ideas/components/IdeasCollectionsBar.tsx", import.meta.url), "utf8");
assert.doesNotMatch(grid, /columns-\d|column-count|grid-flow-dense/);
assert.match(grid, /ResizeObserver/);
assert.match(grid, /useLayoutEffect/);
assert.match(grid, /SSR_MASONRY_CONFIG/);
assert.match(ideas, /<OrderedMasonryGrid/);
assert.match(ideas, /key: idea\.id/);
assert.match(collections, /<OrderedMasonryGrid/);
assert.match(collections, /key: item\.id/);

console.log("Ordered masonry: breakpoints, shortest-column placement, append stability, contracts: OK");
