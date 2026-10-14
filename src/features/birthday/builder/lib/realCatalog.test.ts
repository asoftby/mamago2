import assert from "node:assert/strict";
import { catalogPriceLabel } from "./catalogSelection";
import { extractPartyDetails, matchesBirthdayRequirements, publicPriceFrom, type BirthdayCatalogItem } from "./realCatalog";

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
// Guest group is a range: capacity must overlap it.
assert.equal(matchesBirthdayRequirements(offer, { childrenMin: 13, childrenMax: 15 }), false); // offer max 12
assert.equal(matchesBirthdayRequirements(offer, { childrenMin: 1, childrenMax: 4 }), false); // offer min 5
assert.equal(matchesBirthdayRequirements(offer, { childrenMin: 10, childrenMax: 15 }), true);
assert.equal(matchesBirthdayRequirements({ ...offer, minChildren: null, maxChildren: null }, { childrenMin: 15, childrenMax: null }), true);
// A stale number behind ON_REQUEST must not surface as a price; FREE is a real zero.
assert.equal(publicPriceFrom("ON_REQUEST", 500), null);
assert.equal(publicPriceFrom("UNKNOWN", 500), null);
assert.equal(publicPriceFrom("FREE", null), 0);
assert.equal(publicPriceFrom("FROM", 120), 120);
assert.equal(publicPriceFrom("EXACT", -1), null);
assert.equal(catalogPriceLabel({ priceFrom: 0, priceMode: "FREE", currency: "BYN" }), "Бесплатно");
assert.equal(catalogPriceLabel({ priceFrom: null, priceMode: "ON_REQUEST", currency: "BYN" }), "Цена по запросу");
assert.ok(catalogPriceLabel({ priceFrom: 90, priceMode: "FROM", currency: "BYN" }).startsWith("От "));
assert.ok(!catalogPriceLabel({ priceFrom: 90, priceMode: "EXACT", currency: "BYN" }).startsWith("От "));
console.log("realCatalog.test.ts: OK");
