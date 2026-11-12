import assert from "node:assert/strict";
import test from "node:test";
import { deriveCollectionPartyMode, type CollectionPartyOffer } from "./collectionPartyLead";

const base: CollectionPartyOffer = {
  id: "o1",
  productType: "PARTY_PACKAGE",
  category: null,
  partyLocationType: "ON_SITE",
  hasApprovedBirthdayPlacement: true,
  ownerBusinessId: "b1",
};

test("on-site package anchors a package party", () => {
  assert.equal(deriveCollectionPartyMode(base), "PACKAGE");
});

test("off-site package anchors a home party", () => {
  assert.equal(deriveCollectionPartyMode({ ...base, partyLocationType: "OFF_SITE" }), "HOME");
});

test("venue service anchors a venue party", () => {
  assert.equal(deriveCollectionPartyMode({ ...base, productType: "PARTY_SERVICE", category: "VENUE" }), "VENUE");
});

test("animator anchors a home party", () => {
  assert.equal(deriveCollectionPartyMode({ ...base, productType: "PARTY_SERVICE", category: "ANIMATOR", partyLocationType: null }), "HOME");
});

test("cake or food cannot anchor a party", () => {
  assert.equal(deriveCollectionPartyMode({ ...base, productType: "PARTY_SERVICE", category: "CAKE" }), null);
});

test("no birthday placement, no owner or non-party offer means no lead button", () => {
  assert.equal(deriveCollectionPartyMode({ ...base, hasApprovedBirthdayPlacement: false }), null);
  assert.equal(deriveCollectionPartyMode({ ...base, ownerBusinessId: null }), null);
  assert.equal(deriveCollectionPartyMode({ ...base, productType: "CAMP" }), null);
});
