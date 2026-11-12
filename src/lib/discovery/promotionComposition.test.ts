import assert from "node:assert/strict";
import { composePromotedCards } from "./promotionComposition";
const paid = Array.from({ length: 8 }, (_, i) => ({ id: `paid${i}`, isPromoted: true }));
const organic = Array.from({ length: 24 }, (_, i) => ({ id: `organic${i}`, isPromoted: false }));
const result = composePromotedCards([...paid, ...organic]);
assert.equal(result.length, 32);
assert.equal(new Set(result.map(row => row.id)).size, 32);
for (let n = 1; n <= 32; n++) assert.ok(result.slice(0, n).filter(row => row.isPromoted).length <= Math.floor(n / 4));
assert.deepEqual(result.filter(row => row.isPromoted), paid);
assert.deepEqual(result.filter(row => !row.isPromoted), organic);
assert.deepEqual(composePromotedCards(paid), paid, "scarcity does not fabricate inventory");
assert.deepEqual(composePromotedCards([...paid, ...organic], row => row.isPromoted ? "tomorrow" : "next-month"), [...paid, ...organic], "never substitute worse temporal relevance");
const free = Array.from({ length: 8 }, (_, i) => ({ id: `free${i}`, isPromoted: false }));
const mixed = composePromotedCards(
  [...paid, ...free, ...organic],
  () => "same-band",
  row => row.id.startsWith("free"),
);
assert.equal(mixed.length, 40);
assert.equal(new Set(mixed.map(row => row.id)).size, 40);
assert.deepEqual(mixed.filter(row => row.isPromoted), paid);
assert.deepEqual(mixed.filter(row => row.id.startsWith("free")), free);
assert.deepEqual(mixed.filter(row => row.id.startsWith("organic")), organic);
// While there is still organic inventory, one Boost of either kind
// occupies at most every fourth position; paid fills premium slots first.
for (let n = 1; n <= 32; n++) {
  const boosted = mixed.slice(0, n).filter(row => row.isPromoted || row.id.startsWith("free"));
  assert.ok(boosted.length <= Math.floor(n / 4), `Boost density exceeded at ${n}`);
}
assert.equal(mixed.slice(0, 32).filter(row => row.id.startsWith("free")).length, 0,
  "Paid priority prevents free Boost from displacing paid slots");
const freeOnly = composePromotedCards(
  [...free, ...organic],
  () => "all",
  row => row.id.startsWith("free"),
);
assert.equal(freeOnly.length, free.length + organic.length);
for (let n = 1; n <= 32; n++) {
  assert.ok(freeOnly.slice(0, n).filter(row => row.id.startsWith("free")).length <= Math.floor(n / 4));
}
assert.deepEqual(composePromotedCards(free, () => "all", () => true), free,
  "Free-only scarcity retains eligible inventory");

console.log("promotion composition: OK");
