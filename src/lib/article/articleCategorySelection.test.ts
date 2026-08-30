import assert from "node:assert/strict";
import test from "node:test";
import { assertArticleCategorySelectionShape } from "./articleCategorySelection";

test("accepts ordered unique additional categories", () => {
  assert.doesNotThrow(() => assertArticleCategorySelectionShape("primary", ["second", "third"]));
});
test("accepts a primary-only article", () => {
  assert.doesNotThrow(() => assertArticleCategorySelectionShape("primary", []));
});

test("rejects the primary category among additional categories", () => {
  assert.throws(
    () => assertArticleCategorySelectionShape("primary", ["second", "primary"]),
    /Основная категория/,
  );
});

test("rejects duplicate additional categories", () => {
  assert.throws(
    () => assertArticleCategorySelectionShape(null, ["second", "second"]),
    /не должны повторяться/,
  );
});
