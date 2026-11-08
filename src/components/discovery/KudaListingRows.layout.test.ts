import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./KudaMasonryListing.tsx", import.meta.url), "utf8");

test("Kuda listing fills four columns at desktop widths and keeps mobile responsive", () => {
  assert.match(source, /grid grid-cols-2 items-start/);
  assert.match(source, /sm:grid-cols-3/);
  assert.match(source, /md:grid-cols-4/);
  assert.doesNotMatch(source, /min-\\[1025px\\]:grid-cols-4/);
});

test("main and alternative feeds share the same ordered row grid", () => {
  assert.match(source, /<KudaListingRows items=\\{toMasonry\\(primary, listing\\.offset\\)\\} \\/>/);
  assert.match(source, /<KudaListingRows\\s+items=\\{\\[/);
  assert.doesNotMatch(source, /OrderedMasonryGrid/);
});
