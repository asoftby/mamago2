import assert from "node:assert/strict";
import { buildImportedObjectsWhere, WAITING_FOR_NORMALIZATION } from "./page";

// Channel posts that are saved but not normalized yet never appear in the open stages...
for (const stage of ["PENDING", "IN_PROGRESS"] as const) {
  assert.deepEqual(buildImportedObjectsWhere({ stage }).NOT, WAITING_FOR_NORMALIZATION, stage);
}
// ...but stay visible in the full list and in the finished stage.
assert.equal("NOT" in buildImportedObjectsWhere({ stage: "COMPLETED" }), false);
assert.equal("NOT" in buildImportedObjectsWhere({}), false);
assert.equal("NOT" in buildImportedObjectsWhere({ stage: undefined, sourceId: "s1" }), false);

// The exclusion is exactly "channel source AND not normalized yet": other sources are never hidden.
assert.deepEqual(WAITING_FOR_NORMALIZATION, { normalizeStatus: "PENDING", source: { type: "TELEGRAM_CHANNEL" } });

// Other filters keep working next to it.
assert.deepEqual(buildImportedObjectsWhere({ stage: "PENDING", sourceId: "s1", entityType: "EVENT" }), {
  reviewStatus: "PENDING",
  NOT: WAITING_FOR_NORMALIZATION,
  sourceId: "s1",
  entityTypeHint: "EVENT",
});

console.log("review page waiting-for-normalization tests: OK");
