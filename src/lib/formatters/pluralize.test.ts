import assert from "node:assert/strict";
import test from "node:test";
import { pluralize } from "./pluralize";

test("Russian event plural forms: 1, 2, 5 and teens", () => {
  const forms = ["событие", "события", "событий"] as const;
  assert.equal(pluralize(1, forms), "1 событие");
  assert.equal(pluralize(2, forms), "2 события");
  assert.equal(pluralize(5, forms), "5 событий");
  assert.equal(pluralize(11, forms), "11 событий");
  assert.equal(pluralize(21, forms), "21 событие");
});
