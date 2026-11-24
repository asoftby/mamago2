import assert from "node:assert/strict";
import { composePromotedCards } from "./promotionComposition";
const paid = Array.from({ length: 8 }, (_, i) => ({ id: `paid${i}`, isPromoted: true }));
const organic = Array.from({ length: 24 }, (_, i) => ({ id: `organic${i}`, isPromoted: false }));
const result = composePromotedCards([...paid, ...organic]);
assert.equal(result.length, 32);
assert.equal(new Set(result.map(row => row.id)).size, 32);
for (let n = 1; n <= 32; n++) assert.ok(result.slice(0, n).filter(row => row.isPromoted).length <= Math.ceil(n / 4));
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
// occupies at most one position per four-card block; paid fills premium slots first.
for (let n = 1; n <= 32; n++) {
  const boosted = mixed.slice(0, n).filter(row => row.isPromoted || row.id.startsWith("free"));
  assert.ok(boosted.length <= Math.ceil(n / 4), `Boost density exceeded at ${n}`);
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
  assert.ok(freeOnly.slice(0, n).filter(row => row.id.startsWith("free")).length <= Math.ceil(n / 4));
}
assert.deepEqual(freeOnly.slice(0, 4).map(row => row.id), ["free0", "organic0", "organic1", "organic2"]);
assert.deepEqual(mixed.slice(0, 4).map(row => row.id), ["paid0", "organic0", "organic1", "organic2"]);
assert.deepEqual(composePromotedCards(free, () => "all", () => true), free,
  "Free-only scarcity retains eligible inventory");

// Regression: two otherwise equally relevant same-date events.
const sameDay = composePromotedCards([
  { id: "ordinary", isPromoted: false },
  { id: "promoted", isPromoted: true },
], () => "2026-11-28");
assert.deepEqual(sameDay.map(row => row.id), ["promoted", "ordinary"]);
// Different relevance bands remain authoritative even with a paid Boost.
const differentDates = composePromotedCards([
  { id: "today", isPromoted: false },
  { id: "next-month-paid", isPromoted: true },
], row => row.id === "today" ? "today" : "next-month");
assert.deepEqual(differentDates.map(row => row.id), ["today", "next-month-paid"]);

console.log("promotion composition: OK");
