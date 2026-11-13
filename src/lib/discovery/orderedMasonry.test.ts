import assert from "node:assert/strict";
import test from "node:test";
import { columnCountForWidth, distributeIntoColumns, estimateCardHeight, stackColumns } from "./orderedMasonry";

test("each card goes to the shortest column, ties to the leftmost", () => {
  assert.deepEqual(distributeIntoColumns([1, 1, 1, 1, 1], 3), [[0, 3], [1, 4], [2]]);
  // heights: col0=3, col1=1, col2=1 → next goes to col1 (leftmost of the shortest)
  assert.deepEqual(distributeIntoColumns([3, 1, 1, 1, 1], 3), [[0], [1, 3], [2, 4]]);
});

test("feed order is preserved inside every column and each index appears once", () => {
  const heights = Array.from({ length: 37 }, (_, i) => 1 + ((i * 7) % 5) / 4);
  for (const count of [1, 2, 3, 4]) {
    const columns = distributeIntoColumns(heights, count);
    assert.equal(columns.length, count);
    for (const column of columns) assert.deepEqual(column, [...column].sort((a, b) => a - b));
    assert.deepEqual(columns.flat().sort((a, b) => a - b), heights.map((_, i) => i));
  }
});

test("append-only: adding cards never moves already placed ones", () => {
  const heights = Array.from({ length: 30 }, (_, i) => 1.25 + (i % 4) * 0.2);
  for (const count of [2, 3, 4]) {
    const before = distributeIntoColumns(heights.slice(0, 18), count);
    const after = distributeIntoColumns(heights, count);
    before.forEach((column, c) => assert.deepEqual(after[c].slice(0, column.length), column));
  }
});

test("changing the column count redistributes every card exactly once", () => {
  const heights = [1.5, 1.25, 1.8, 1.25, 1.5, 1.25, 1.8, 1.5];
  const two = distributeIntoColumns(heights, 2);
  const four = distributeIntoColumns(heights, 4);
  assert.equal(two.length, 2);
  assert.equal(four.length, 4);
  assert.deepEqual(four.map((c) => c[0]), [0, 1, 2, 3]);
  assert.equal(two.flat().length, heights.length);
});

test("column heights stay balanced (no gaps under short cards)", () => {
  const heights = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 1.7 : 1.1));
  const columns = distributeIntoColumns(heights, 4);
  const totals = columns.map((c) => c.reduce((sum, i) => sum + heights[i], 0));
  assert.ok(Math.max(...totals) - Math.min(...totals) <= Math.max(...heights));
});

test("degenerate input", () => {
  assert.deepEqual(distributeIntoColumns([], 3), [[], [], []]);
  assert.deepEqual(distributeIntoColumns([1, 1], 0), [[0, 1]]);
  assert.deepEqual(distributeIntoColumns([NaN, 1, 1], 2), [[0, 2], [1]]);
});

test("breakpoints match Tailwind sm/md and estimate includes the details block", () => {
  assert.equal(columnCountForWidth(375), 2);
  assert.equal(columnCountForWidth(640), 3);
  assert.equal(columnCountForWidth(767), 3);
  assert.equal(columnCountForWidth(768), 4);
  assert.ok(estimateCardHeight(1.25, 2) > 1.25);
});

test("stackColumns stacks measured heights per column with row gap", () => {
  const columns = distributeIntoColumns([1, 1, 1, 1, 1], 2); // [[0,2,4],[1,3]]
  const heights = [100, 50, 70, 60, 30];
  const stacked = stackColumns(columns, heights, 10);
  assert.deepEqual(stacked.tops, [0, 0, 110, 60, 190]);
  assert.deepEqual(stacked.columnOf, [0, 1, 0, 1, 0]);
  assert.equal(stacked.height, 220);
  assert.deepEqual(stackColumns([[], []], [], 10), { tops: [], columnOf: [], height: 0 });
});
