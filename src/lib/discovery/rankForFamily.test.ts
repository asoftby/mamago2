import assert from "node:assert/strict";
import test from "node:test";
import { rankForFamily } from "./rankForFamily";

test("personalized scoring never removes, duplicates or adds candidate IDs", () => {
  const candidates = [{ id: "adult" }, { id: "child" }, { id: "unknown" }];
  const result = rankForFamily(candidates, item => item.id === "child" ? 100 : 0);
  assert.deepEqual(result.map(x => x.id), ["child", "adult", "unknown"]);
  assert.deepEqual(new Set(result.map(x => x.id)), new Set(candidates.map(x => x.id)));
  assert.deepEqual(candidates.map(x => x.id), ["adult", "child", "unknown"]);
});

test("guests and families receive the same complete set across the ranking policy", () => {
  const candidates = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
  const guest = rankForFamily(candidates, (_, index) => -index);
  const family = rankForFamily(candidates, (x) => Number(x.id) % 7);
  assert.deepEqual(guest.map(x => x.id).sort(), family.map(x => x.id).sort());
});

test("stable tie ranking and empty candidate set", () => {
  const candidates = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(rankForFamily(candidates, () => 5), candidates);
  assert.deepEqual(rankForFamily([], () => 0), []);
});
