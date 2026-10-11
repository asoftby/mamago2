import assert from "node:assert/strict";
import { extractPartyDetails, matchesBirthdayRequirements, type BirthdayCatalogItem } from "./realCatalog";

assert.deepEqual(extractPartyDetails({
  includedCategories: ["VENUE", "CAKE", "INJECTED", "CAKE"],
  prepaymentTerms: "30% после подтверждения",
}, [{ category: "DECOR", isOptional: false }, { category: "FOOD", isOptional: true }]), {
  includedCategories: ["VENUE", "CAKE", "DECOR"],
  prepaymentTerms: "30% после подтверждения",
  cancellationTerms: null,
});
const offer: BirthdayCatalogItem = {
  id: "offer1", title: "Торт", productType: "PARTY_SERVICE", category: "CAKE",
  businessId: "b1", businessName: "Кондитер", placeId: "p1", placeTitle: "Кондитерская",
  coverImage: null, priceFrom: 180, priceMode: "FROM", currency: "BYN",
  ageMinMonths: 48, ageMaxMonths: 144, minChildren: 5, maxChildren: 12,
  locationType: "OFF_SITE", includedCategories: [],
  prepaymentTerms: null, cancellationTerms: null,
};
assert.equal(matchesBirthdayRequirements(offer, { ageMonths: 72, children: 8, maxBudget: 200 }), true);
assert.equal(matchesBirthdayRequirements(offer, { ageMonths: 24 }), false);
assert.equal(matchesBirthdayRequirements(offer, { children: 20 }), false);
assert.equal(matchesBirthdayRequirements(offer, { maxBudget: 100 }), false);
assert.equal(matchesBirthdayRequirements({ ...offer, priceFrom: null }, { maxBudget: 100 }), true);
// Unknown price is retained as unknown (not zero), and is never claimed affordable.
console.log("realCatalog.test.ts: OK");
