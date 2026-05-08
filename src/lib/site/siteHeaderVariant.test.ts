import assert from "node:assert/strict";

import { getSiteHeaderVariant } from "./siteHeaderVariant";

assert.equal(getSiteHeaderVariant("/minsk"), "discovery");
assert.equal(getSiteHeaderVariant("/minsk/events"), "discovery");
assert.equal(getSiteHeaderVariant("/minsk/events/master-klass"), "discovery");

assert.equal(getSiteHeaderVariant("/me/ideas"), "discovery");
assert.equal(getSiteHeaderVariant("/admin"), "discovery");
assert.equal(getSiteHeaderVariant("/business/dashboard"), "discovery");
assert.equal(getSiteHeaderVariant("/unknown-city"), "discovery");
assert.equal(getSiteHeaderVariant("/ideas"), "landing");

console.log("siteHeaderVariant tests: OK");
