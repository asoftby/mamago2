import assert from "node:assert/strict";

import {
  getCityFromPath,
  getIntentFromPath,
  isCityHubPath,
  isPublicationDetailPath,
} from "./intent";

assert.equal(getCityFromPath("/minsk"), "minsk");
assert.equal(getCityFromPath("/minsk/events"), "minsk");
assert.equal(getCityFromPath("/me/ideas"), null);
assert.equal(getCityFromPath("/me/plan"), null);
assert.equal(getCityFromPath("/admin"), null);
assert.equal(getCityFromPath("/business/dashboard"), null);

assert.equal(isCityHubPath("/minsk"), true);
assert.equal(isCityHubPath("/marina-gorka"), true);
assert.equal(isCityHubPath("/unknown-city"), false);
assert.equal(isCityHubPath("/me"), false);

assert.equal(getIntentFromPath("/minsk/events"), "kuda");
assert.equal(getIntentFromPath("/minsk/classes"), "classes");
assert.equal(getIntentFromPath("/me/events"), null);
assert.equal(getIntentFromPath("/admin/events"), null);
assert.equal(getIntentFromPath("/unknown-city/events"), null);

assert.equal(isPublicationDetailPath("/minsk/events/master-klass"), true);
assert.equal(isPublicationDetailPath("/minsk/activity/abc123"), true);
assert.equal(isPublicationDetailPath("/me/events/master-klass"), false);
assert.equal(isPublicationDetailPath("/unknown-city/events/master-klass"), false);

console.log("intent city routing tests: OK");
