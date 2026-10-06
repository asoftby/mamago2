import assert from "node:assert/strict";
import { resolveActivityBusinessIdForCreate } from "./activityBusinessResolution";

assert.equal(
  resolveActivityBusinessIdForCreate({
    placeOwnerBusinessId: "business-place-owner",
    requestedBusinessId: "business-requested",
    userBusinessId: "business-user",
  }),
  "business-place-owner",
  "a business-owned place must remain authoritative",
);

assert.equal(
  resolveActivityBusinessIdForCreate({
    placeOwnerBusinessId: null,
    requestedBusinessId: "business-requested",
    userBusinessId: "business-user",
  }),
  "business-requested",
  "an explicit allowed business should be preserved for an unowned place",
);

assert.equal(
  resolveActivityBusinessIdForCreate({
    placeOwnerBusinessId: null,
    requestedBusinessId: null,
    userBusinessId: "business-user",
  }),
  "business-user",
  "an unowned legacy place must fall back to the user's active partner business",
);

assert.equal(
  resolveActivityBusinessIdForCreate({
    placeOwnerBusinessId: undefined,
    requestedBusinessId: null,
    userBusinessId: null,
  }),
  null,
  "missing place and partner business must remain unscoped",
);

console.log("activityAccess create business resolution: ok");
