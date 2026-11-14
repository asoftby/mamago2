import assert from "node:assert/strict";
import {
  resolveActivityBusinessIdForCreate,
  resolveActivityBusinessIdForPatch,
} from "./activityBusinessResolution";

// Event ownership is separate from the informational Organizer and editor.
assert.equal(
  resolveActivityBusinessIdForPatch({
    existingBusinessId: null,
    authorBusinessId: "author-business",
  }),
  "author-business",
);

// Do not move existing bookings to a different business.
assert.equal(
  resolveActivityBusinessIdForPatch({
    existingBusinessId: "original-recipient",
    authorBusinessId: "author-business",
  }),
  "original-recipient",
);

// An author without a business stays without a business; booking requires a
// separate author-owned recipient/inbox flow, not a fabricated business.
assert.equal(
  resolveActivityBusinessIdForPatch({
    existingBusinessId: null,
    authorBusinessId: null,
  }),
  null,
);

assert.equal(
  resolveActivityBusinessIdForCreate({
    placeOwnerBusinessId: null,
    requestedBusinessId: null,
    userBusinessId: "creator-business",
  }),
  "creator-business",
);

console.log("activityBusinessResolution: ok");
