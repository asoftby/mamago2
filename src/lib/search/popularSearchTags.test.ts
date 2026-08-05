import assert from "node:assert/strict";
import {
  MIN_POPULAR_TAG_SEARCH_COUNT,
  POPULAR_SEARCH_TAG_CANDIDATES,
  resolveVisiblePopularTags,
} from "./popularSearchTags";

assert.equal(MIN_POPULAR_TAG_SEARCH_COUNT, 20);
assert.ok(POPULAR_SEARCH_TAG_CANDIDATES.length > 0);

assert.deepEqual(resolveVisiblePopularTags(), []);

assert.deepEqual(
  resolveVisiblePopularTags({
    театр: 19,
    батуты: 20,
    "мастер-классы": 100,
  }),
  ["Батуты", "Мастер-классы"],
);

assert.deepEqual(
  resolveVisiblePopularTags({
    театр: 20,
    батуты: 20,
    "мастер-классы": 20,
    логопед: 20,
    аниматоры: 20,
  }),
  [...POPULAR_SEARCH_TAG_CANDIDATES],
);

console.log("popularSearchTags tests: OK");
