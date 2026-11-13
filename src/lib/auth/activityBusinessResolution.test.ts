import assert from "node:assert/strict";
import {
  resolveActivityBusinessIdForCreate,
  resolveActivityBusinessIdForPatch,
} from "./activityBusinessResolution";

// An event without a business adopts the saver's business.
assert.equal(
  resolveActivityBusinessIdForPatch({ nextBusinessId: undefined, existingBusinessId: null, userBusinessId: "biz-user" }),
  "biz-user",
);

// An existing business is never replaced by the saver's.
assert.equal(
  resolveActivityBusinessIdForPatch({ nextBusinessId: undefined, existingBusinessId: "biz-event", userBusinessId: "biz-user" }),
  "biz-event",
);

// A business chosen via the place or the request wins over the fallback.
assert.equal(
  resolveActivityBusinessIdForPatch({ nextBusinessId: "biz-place", existingBusinessId: null, userBusinessId: "biz-user" }),
  "biz-place",
);

// No business anywhere stays business-less.
assert.equal(
  resolveActivityBusinessIdForPatch({ nextBusinessId: undefined, existingBusinessId: null, userBusinessId: null }),
  null,
);

// Creation falls back to the creator's business.
assert.equal(
  resolveActivityBusinessIdForCreate({ placeOwnerBusinessId: null, requestedBusinessId: null, userBusinessId: "biz-user" }),
  "biz-user",
);

console.log("activityBusinessResolution: ok");
