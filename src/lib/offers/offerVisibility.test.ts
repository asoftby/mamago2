import assert from "node:assert/strict";

import { getOfferHiddenReason, isOfferPubliclyVisible } from "./offerVisibility";

function main() {
  assert.equal(isOfferPubliclyVisible(null), false);
  assert.equal(isOfferPubliclyVisible(undefined), false);

  assert.equal(
    isOfferPubliclyVisible({ status: "DRAFT", place: { status: "PUBLISHED", archivedAt: null } }),
    false,
    "DRAFT is never publicly visible",
  );

  // Structurally should never happen (write-side gates require a Place for
  // PUBLISHED), but visibility must fail closed, not crash or pass through.
  assert.equal(
    isOfferPubliclyVisible({ status: "PUBLISHED", place: null }),
    false,
    "a PUBLISHED offer without a Place must not be reported visible",
  );

  assert.equal(
    isOfferPubliclyVisible({ status: "PUBLISHED", archivedAt: null, place: { status: "PUBLISHED", archivedAt: null } }),
    true,
  );

  assert.equal(
    isOfferPubliclyVisible({ status: "PUBLISHED", archivedAt: new Date(), place: { status: "PUBLISHED", archivedAt: null } }),
    false,
    "an archived offer is not visible",
  );

  assert.equal(
    isOfferPubliclyVisible({
      status: "PUBLISHED",
      archivedAt: null,
      place: { status: "PUBLISHED", archivedAt: null, ownerBusiness: { operationalStatus: "DISABLED" } },
    }),
    false,
    "a non-ACTIVE owning business hides the offer",
  );

  // #706: a PUBLISHED Offer on a Place that is not itself PUBLISHED is invisible to
  // the SQL loader (getPublicPublishedOfferWhere), so the page check must agree.
  for (const placeStatus of ["DRAFT", "PENDING", "NEEDS_REVISION", "REJECTED", "ARCHIVED", "DELETED", ""]) {
    assert.equal(
      isOfferPubliclyVisible({ status: "PUBLISHED", archivedAt: null, place: { status: placeStatus, archivedAt: null } }),
      false,
      `Place status ${placeStatus || "(empty)"} hides the offer`,
    );
  }
  assert.equal(
    getOfferHiddenReason({ status: "PUBLISHED", archivedAt: null, place: { status: "PENDING", archivedAt: null } }),
    "PLACE_NOT_PUBLISHED",
  );
  assert.equal(
    getOfferHiddenReason({ status: "PUBLISHED", archivedAt: null, place: { status: "PUBLISHED", archivedAt: new Date() } }),
    "PLACE_ARCHIVED",
  );
  assert.equal(getOfferHiddenReason({ status: "PUBLISHED", place: null }), "PLACE_MISSING");
  assert.equal(getOfferHiddenReason({ status: "PENDING", place: { status: "PUBLISHED" } }), "OFFER_NOT_PUBLISHED");
  assert.equal(
    getOfferHiddenReason({ status: "PUBLISHED", archivedAt: null, place: { status: "PUBLISHED", archivedAt: null } }),
    null,
  );
  // A Place without an owning business (ownerBusiness null/undefined) stays visible.
  assert.equal(
    isOfferPubliclyVisible({ status: "PUBLISHED", place: { status: "PUBLISHED", ownerBusiness: null } }),
    true,
  );
}

main();
console.log("offerVisibility tests: OK");
