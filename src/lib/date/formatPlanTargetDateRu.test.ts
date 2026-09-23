import assert from "node:assert/strict";
import { formatPlanTargetDateRu } from "./formatPlanTargetDateRu";

assert.equal(
  formatPlanTargetDateRu("2026-09-26"),
  "субботу, 26 сентября",
  "Saturday must use accusative case after «на»",
);

assert.equal(
  formatPlanTargetDateRu("2026-09-25"),
  "пятницу, 25 сентября",
  "Friday must use accusative case after «на»",
);

console.log("formatPlanTargetDateRu.test.ts: OK");
