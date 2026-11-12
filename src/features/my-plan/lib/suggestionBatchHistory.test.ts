import assert from "node:assert/strict";
import {
  appendSuggestionBatch,
  canGoBackSuggestionBatch,
  currentSuggestionBatch,
  emptySuggestionBatchHistory,
  goBackSuggestionBatch,
} from "./suggestionBatchHistory";

const empty = emptySuggestionBatchHistory<string>();
assert.deepEqual(empty, { batches: [], index: -1 });
assert.equal(canGoBackSuggestionBatch(empty), false);
assert.equal(currentSuggestionBatch(empty), null);

let h = appendSuggestionBatch(empty, ["a", "b"], 3);
assert.deepEqual(currentSuggestionBatch(h), ["a", "b"]);
assert.equal(canGoBackSuggestionBatch(h), false);
assert.equal(h.index, 0);

h = appendSuggestionBatch(h, ["c"], 3);
assert.deepEqual(currentSuggestionBatch(h), ["c"]);
assert.equal(canGoBackSuggestionBatch(h), true);
assert.equal(h.batches.length, 2);

h = goBackSuggestionBatch(h);
assert.deepEqual(currentSuggestionBatch(h), ["a", "b"]);
assert.equal(h.index, 0);
assert.equal(canGoBackSuggestionBatch(h), false);

// Back at first batch is a no-op.
assert.deepEqual(goBackSuggestionBatch(h), h);

// After going back, append truncates the forward tail (browser-history semantics).
h = appendSuggestionBatch(h, ["d"], 3);
assert.deepEqual(h.batches, [["a", "b"], ["d"]]);
assert.equal(h.index, 1);

// Cap drops the oldest when exceeding maxBatches.
h = appendSuggestionBatch(h, ["e"], 2);
assert.deepEqual(h.batches, [["d"], ["e"]]);
assert.equal(h.index, 1);
assert.equal(canGoBackSuggestionBatch(h), true);

console.log("suggestionBatchHistory tests: OK");
