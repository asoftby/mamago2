import assert from "node:assert/strict";
import { resolvePlanItemCategoryLabel } from "./planItemMeta";

assert.equal(
  resolvePlanItemCategoryLabel({ categoryLabel: "Мастер-классы" }),
  "Мастер-классы",
  "real structured category is returned as-is",
);

assert.equal(
  resolvePlanItemCategoryLabel({ categoryLabel: null }),
  null,
  "no category -> slot omitted, never fabricated",
);

assert.equal(
  resolvePlanItemCategoryLabel({ categoryLabel: "   " }),
  null,
  "whitespace-only category treated as missing",
);

assert.equal(
  resolvePlanItemCategoryLabel(null),
  null,
  "no activity -> no category",
);

console.log("planItemMeta tests: OK");
