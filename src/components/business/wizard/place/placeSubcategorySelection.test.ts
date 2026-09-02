import * as assert from "node:assert/strict";

import {
  addAdditionalSubcategory,
  deriveSubcategorySelection,
  MAX_ADDITIONAL_SUBCATEGORIES,
  MAX_SUBCATEGORIES,
  removeAdditionalSubcategory,
  setPrimarySubcategory,
} from "./placeSubcategorySelection";

// 1. existing [a,b,c] → primary a, additional [b,c]
assert.deepEqual(
  deriveSubcategorySelection(["a", "b", "c"]),
  { primary: "a", additional: ["b", "c"] },
  "an existing legacy-shaped array reads back as primary=first, additional=rest",
);

// 2. empty → no primary
assert.deepEqual(
  deriveSubcategorySelection([]),
  { primary: null, additional: [] },
  "an empty selection has no primary and no additional",
);

// 3. выбрать primary a → [a]
assert.deepEqual(
  setPrimarySubcategory([], "a"),
  ["a"],
  "picking a primary from an empty selection produces just [primary]",
);

// 4. [a,b,c], сделать b primary → корректный deterministic order без duplicates
{
  const next = setPrimarySubcategory(["a", "b", "c"], "b");
  assert.deepEqual(next, ["b", "a", "c"], "promoting an additional subcategory to primary is deterministic");
  assert.equal(new Set(next).size, next.length, "no duplicates after promotion");
  assert.equal(next[0], "b", "the newly-chosen primary is always at index 0");
}

// 5. добавить additional → primary остаётся первым
{
  const next = addAdditionalSubcategory(["a"], "x");
  assert.deepEqual(next, ["a", "x"]);
  assert.equal(next[0], "a", "primary stays first after adding an additional subcategory");
}
{
  const next = addAdditionalSubcategory(["a", "b"], "c");
  assert.deepEqual(next, ["a", "b", "c"]);
  assert.equal(next[0], "a", "primary stays first even with an existing additional entry");
}

// 6. удалить additional → primary остаётся
{
  const next = removeAdditionalSubcategory(["a", "b", "c"], "b");
  assert.deepEqual(next, ["a", "c"], "removing one additional subcategory keeps the primary and the other additional entry");
}
{
  const next = removeAdditionalSubcategory(["a", "b"], "b");
  assert.deepEqual(next, ["a"], "removing the only additional subcategory leaves just the primary");
}

// 7. нельзя добавить больше 2 additional
{
  const full = ["a", "b", "c"]; // primary + MAX_ADDITIONAL_SUBCATEGORIES already selected
  assert.equal(MAX_ADDITIONAL_SUBCATEGORIES, 2);
  const next = addAdditionalSubcategory(full, "d");
  assert.equal(next, full, "adding beyond the additional cap is a no-op (same reference)");
  assert.equal(next.length, MAX_SUBCATEGORIES);
}

// 8. нельзя добавить primary повторно как additional
{
  const current = ["a", "b"];
  const next = addAdditionalSubcategory(current, "a");
  assert.equal(next, current, "adding the current primary as additional is a no-op (same reference)");
}
// Also can't re-add an already-selected additional entry.
{
  const current = ["a", "b"];
  const next = addAdditionalSubcategory(current, "b");
  assert.equal(next, current, "adding an already-selected additional entry is a no-op (same reference)");
}

// 9. смена root category сбрасывает selection
// (This is component-level behavior — handlePrimaryCategoryChange sets
// subcategoryIds to `[]` directly, unchanged by this refactor. The
// resulting empty state reads back exactly like scenario 2 above.)
assert.deepEqual(deriveSubcategorySelection([]), { primary: null, additional: [] });

// 10. legacy arrays остаются совместимыми
// A single-entry legacy array (only ever had a "primary", no additional
// concept existed yet) reads back correctly.
assert.deepEqual(deriveSubcategorySelection(["only-one"]), { primary: "only-one", additional: [] });
// Defensive: even a malformed/over-long array (should never happen given
// server-side truncation to 3, but the pure reader stays safe regardless)
// never returns more than MAX_ADDITIONAL_SUBCATEGORIES additional entries.
{
  const selection = deriveSubcategorySelection(["a", "b", "c", "d"]);
  assert.equal(selection.primary, "a");
  assert.equal(selection.additional.length, MAX_ADDITIONAL_SUBCATEGORIES);
  assert.deepEqual(selection.additional, ["b", "c"]);
}

// setPrimarySubcategory(null) clears everything.
assert.deepEqual(setPrimarySubcategory(["a", "b", "c"], null), []);

// Re-picking the current primary is an exact no-op (reference equality).
{
  const current = ["a", "b"];
  assert.equal(setPrimarySubcategory(current, "a"), current);
}

// Promoting a brand-new (never-selected) id to primary when already at the
// cap still respects MAX_SUBCATEGORIES and keeps order deterministic.
{
  const next = setPrimarySubcategory(["a", "b", "c"], "z");
  assert.equal(next.length, MAX_SUBCATEGORIES);
  assert.equal(next[0], "z");
  assert.equal(new Set(next).size, next.length);
  assert.deepEqual(next, ["z", "a", "b"], "old primary rejoins first, then old additional entries in order, capped");
}

console.log("placeSubcategorySelection tests: OK");
