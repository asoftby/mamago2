import assert from "node:assert/strict";

import { isOfferPubliclyVisible } from "./offerVisibility";

function main() {
  assert.equal(isOfferPubliclyVisible(null), false);
  assert.equal(isOfferPubliclyVisible(undefined), false);

  assert.equal(
    isOfferPubliclyVisible({ status: "DRAFT", place: { archivedAt: null } }),
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
    isOfferPubliclyVisible({ status: "PUBLISHED", archivedAt: null, place: { archivedAt: null } }),
    true,
  );

  assert.equal(
    isOfferPubliclyVisible({ status: "PUBLISHED", archivedAt: new Date(), place: { archivedAt: null } }),
    false,
    "an archived offer is not visible",
  );

  assert.equal(
    isOfferPubliclyVisible({
      status: "PUBLISHED",
      archivedAt: null,
      place: { archivedAt: null, ownerBusiness: { operationalStatus: "DISABLED" } },
    }),
    false,
    "a non-ACTIVE owning business hides the offer",
  );
}

main();
console.log("offerVisibility tests: OK");
