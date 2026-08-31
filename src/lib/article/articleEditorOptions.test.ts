import assert from "node:assert/strict";
import { buildArticleEditorCityOptionsWhere } from "./articleEditorOptions";

assert.deepEqual(buildArticleEditorCityOptionsWhere([]), {
  isLegacyNonCity: false,
  OR: [{ isActive: true }],
});
assert.deepEqual(buildArticleEditorCityOptionsWhere(["inactive-selected"]), {
  isLegacyNonCity: false,
  OR: [{ isActive: true }, { id: { in: ["inactive-selected"] } }],
});

console.log("articleEditorOptions.test.ts: OK");
