import assert from "node:assert/strict";
import { shouldIndexTagPage, DISCOVERY_TAG_AUTO_INDEX_MIN_ARTICLES } from "./discoveryTagIndexing";

assert.equal(DISCOVERY_TAG_AUTO_INDEX_MIN_ARTICLES, 5);
for (const count of [0, 1, 4]) assert.equal(shouldIndexTagPage("AUTO", count), false);
for (const count of [5, 6, 100]) assert.equal(shouldIndexTagPage("AUTO", count), true);
assert.equal(shouldIndexTagPage("INDEX", 0), false);
assert.equal(shouldIndexTagPage("INDEX", 1), true);
assert.equal(shouldIndexTagPage("NOINDEX", 100), false);
