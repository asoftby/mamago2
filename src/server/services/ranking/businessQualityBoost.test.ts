import assert from "node:assert/strict";
import {
  applyActivePublicationBoost,
  applyBusinessQualityBoost,
  getPublicationBoostLevel,
} from "./businessQualityBoost";

assert.equal(getPublicationBoostLevel([]), "NONE");
assert.equal(getPublicationBoostLevel([{ isFreeDaily: true }]), "FREE");
assert.equal(getPublicationBoostLevel([{ isFreeDaily: false }]), "PAID");
assert.equal(getPublicationBoostLevel([{ isFreeDaily: true }, { isFreeDaily: false }]), "PAID");
assert.equal(applyActivePublicationBoost(25, "PAID", 1.1), 1025);
assert.equal(applyActivePublicationBoost(25, "FREE", 1.1), 31);
assert.equal(
  applyActivePublicationBoost(100, "NONE", 1.1),
  applyBusinessQualityBoost(100, 1.1),
);
assert.ok(
  applyActivePublicationBoost(0, "PAID", 1) >
    applyActivePublicationBoost(0, "FREE", 1),
);

console.log("publication ranking boost tests: OK");
