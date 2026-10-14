import assert from "node:assert/strict";
import {
  catalogPriceLabel, compatibleAddonIds, compatibleCatalogSelection,
  eligibleAddons, hasValidCatalogAnchor, isAllowedBase, isLocationCompatible,
} from "./catalogSelection";
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
// Replacing the base prunes add-ons the new package already includes (and venues).
const venue = { ...offer, id: "v", category: "VENUE" as const, locationType: "ON_SITE" as const };
const pkg = { ...offer, id: "pk", productType: "PARTY_PACKAGE" as const, category: null, includedCategories: ["CAKE" as const], locationType: "ON_SITE" as const };
const cakeAddon = { ...offer, id: "ck", category: "CAKE" as const, locationType: "BOTH" as const };
const showAddon = { ...offer, id: "sh", category: "SHOW" as const, locationType: "BOTH" as const };
const all = [venue, pkg, cakeAddon, showAddon];
assert.deepEqual(compatibleAddonIds(all, "v", "VENUE", ["ck", "sh"]), ["ck", "sh"]);
assert.deepEqual(compatibleAddonIds(all, "pk", "PACKAGE", ["ck", "sh"]), ["sh"]);
assert.deepEqual(compatibleAddonIds(all, "pk", "PACKAGE", ["v", "gone"]), []);
// Missing legacy location data is still discoverable, but an untyped package
// cannot serve as a home/outdoor base.
const onsite = { ...offer, id: "on", locationType: "ON_SITE" as const };
const offsite = { ...offer, id: "off", locationType: "OFF_SITE" as const };
const both = { ...offer, id: "both", locationType: "BOTH" as const };
const legacy = { ...offer, id: "legacy", locationType: null };
const mobilePackage = { ...offsite, id: "mobile-package", productType: "PARTY_PACKAGE" as const, category: null };
const unknownPackage = { ...legacy, id: "unknown-package", productType: "PARTY_PACKAGE" as const, category: null };
const onsiteVenue = { ...onsite, id: "onsite-venue", category: "VENUE" as const };
assert.equal(isLocationCompatible(onsite, "HOME"), false);
assert.equal(isLocationCompatible(offsite, "HOME"), true);
assert.equal(isLocationCompatible(offsite, "VENUE"), false);
assert.equal(isLocationCompatible(both, "OUTDOOR"), true);
assert.equal(isLocationCompatible(both, "PACKAGE"), true);
assert.equal(isLocationCompatible(legacy, "HOME"), true);
assert.equal(isLocationCompatible(onsite, null), true);
assert.equal(isAllowedBase(mobilePackage, "HOME"), true);
assert.equal(isAllowedBase(mobilePackage, "OUTDOOR"), true);
assert.equal(isAllowedBase(unknownPackage, "HOME"), false);
assert.equal(isAllowedBase(unknownPackage, "VENUE"), true);
assert.equal(hasValidCatalogAnchor([mobilePackage], mobilePackage.id, "HOME"), true);
assert.deepEqual(eligibleAddons([onsite, offsite, legacy], "mobile-package", "HOME").map((o) => o.id), ["off", "legacy"]);
assert.deepEqual(eligibleAddons([onsite, offsite, legacy], "onsite-venue", "VENUE").map((o) => o.id), ["on", "legacy"]);
// Changing location prunes an incompatible anchor as well as previously selected add-ons.
const selectionOffers = [onsiteVenue, mobilePackage, offsite, onsite];
assert.deepEqual(
  compatibleCatalogSelection(selectionOffers, "onsite-venue", "HOME", ["off", "on"]),
  { selectedBaseId: null, selectedAddonIds: [] },
);
assert.deepEqual(
  compatibleCatalogSelection(selectionOffers, "mobile-package", "HOME", ["off", "on"]),
  { selectedBaseId: "mobile-package", selectedAddonIds: ["off"] },
);
assert.deepEqual(
  compatibleCatalogSelection(selectionOffers, "mobile-package", "VENUE", ["off"]),
  { selectedBaseId: null, selectedAddonIds: [] },
);
console.log("realCatalog.test.ts: OK");
