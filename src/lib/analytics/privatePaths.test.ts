import assert from "node:assert/strict";

import { isCapabilityUrlPath } from "./privatePaths";

assert.equal(isCapabilityUrlPath("/w/abc123"), true);
assert.equal(isCapabilityUrlPath("/w/abc123/"), true);
assert.equal(isCapabilityUrlPath("/minsk/events/w/x"), false, "only the top-level /w/ route");
assert.equal(isCapabilityUrlPath("/wishlists"), false);
assert.equal(isCapabilityUrlPath("/w"), false);
assert.equal(isCapabilityUrlPath(null), false);

console.log("privatePaths ok");
