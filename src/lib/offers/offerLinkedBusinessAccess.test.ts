import assert from "node:assert/strict";
import {
  canBypassOfferBusinessPlaceRestriction,
  shouldRejectUnlinkedPlaceForOfferMutation,
  shouldRequireLinkedBusinessPlaceForOfferStatus,
} from "./offerLinkedBusinessAccess";

assert.equal(canBypassOfferBusinessPlaceRestriction("ADMIN"), true);
assert.equal(canBypassOfferBusinessPlaceRestriction("MODERATOR"), true);
assert.equal(canBypassOfferBusinessPlaceRestriction("BUSINESS_OWNER"), false);

assert.equal(
  shouldRequireLinkedBusinessPlaceForOfferStatus({
    role: "ADMIN",
    status: "PUBLISHED",
  }),
  false,
);

// MODERATOR is the current platform role used for editor-level privileged flows.
assert.equal(
  shouldRequireLinkedBusinessPlaceForOfferStatus({
    role: "MODERATOR",
    status: "PENDING",
  }),
  false,
);

assert.equal(
  shouldRequireLinkedBusinessPlaceForOfferStatus({
    role: "BUSINESS_OWNER",
    status: "DRAFT",
  }),
  false,
);

assert.equal(
  shouldRequireLinkedBusinessPlaceForOfferStatus({
    role: "BUSINESS_OWNER",
    status: "PENDING",
  }),
  true,
);

assert.equal(
  shouldRequireLinkedBusinessPlaceForOfferStatus({
    role: "BUSINESS_OWNER",
    status: "PUBLISHED",
  }),
  true,
);

assert.equal(
  shouldRejectUnlinkedPlaceForOfferMutation({
    role: "BUSINESS_OWNER",
    status: "PENDING",
    ownerBusinessId: null,
  }),
  true,
);

assert.equal(
  shouldRejectUnlinkedPlaceForOfferMutation({
    role: "BUSINESS_OWNER",
    status: "PENDING",
    ownerBusinessId: "biz_1",
  }),
  false,
);

assert.equal(
  shouldRejectUnlinkedPlaceForOfferMutation({
    role: "ADMIN",
    status: "PUBLISHED",
    ownerBusinessId: null,
  }),
  false,
);
