import assert from "node:assert/strict";
import {
  applyActivePublicationBoost,
  applyBusinessQualityBoost,
} from "./businessQualityBoost";

assert.equal(applyActivePublicationBoost(25, true, 1.1), 1025);
assert.equal(
  applyActivePublicationBoost(100, false, 1.1),
  applyBusinessQualityBoost(100, 1.1),
);
assert.ok(
  applyActivePublicationBoost(0, true, 1) >
    applyActivePublicationBoost(999, false, 1),
);

console.log("publication ranking boost tests: OK");
