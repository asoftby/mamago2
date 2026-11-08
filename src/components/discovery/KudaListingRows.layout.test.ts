import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./KudaMasonryListing.tsx", import.meta.url), "utf8");

test("Kuda listing fills four columns at desktop widths and keeps mobile responsive", () => {
  assert.ok(source.includes("grid grid-cols-2 items-start"));
  assert.ok(source.includes("sm:grid-cols-3"));
  assert.ok(source.includes("md:grid-cols-4"));
  assert.ok(!source.includes("min-[1025px]:grid-cols-4"));
});

test("main and alternative feeds share the same ordered row grid", () => {
  assert.ok(source.includes("<KudaListingRows items={toMasonry(primary, listing.offset)} />"));
  assert.ok(source.includes("...toMasonry(secondary, listing.offset + primary.length)"));
  assert.equal(source.split("<KudaListingRows").length - 1, 2);
  assert.ok(!source.includes("OrderedMasonryGrid"));
});
