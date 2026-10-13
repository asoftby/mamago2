import assert from "node:assert/strict";
import {
  MAX_OFFER_CATEGORIES,
  checkCategoryIdsShape,
  isCategoryInScope,
  offerCategoryScopeForProductType,
} from "./offerCategories";

assert.equal(MAX_OFFER_CATEGORIES, 3);

// формат → источник категорий
assert.deepEqual(offerCategoryScopeForProductType("PARTY_PACKAGE"), { kind: "offer-prefix", prefix: "party-" });
assert.deepEqual(offerCategoryScopeForProductType("PARTY_SERVICE"), { kind: "offer-prefix", prefix: "party-" });
assert.deepEqual(offerCategoryScopeForProductType("CAMP"), { kind: "offer-prefix", prefix: "camp-" });
assert.deepEqual(offerCategoryScopeForProductType("REGULAR_ACTIVITY"), { kind: "offer-prefix", prefix: "class-" });
assert.deepEqual(offerCategoryScopeForProductType("ONE_TIME_ACTIVITY"), { kind: "offer-prefix", prefix: "class-" });
assert.deepEqual(offerCategoryScopeForProductType("PLACE_VISIT"), { kind: "place-root" });
assert.equal(offerCategoryScopeForProductType(null), null);

// принадлежность категории формату
const party = { publicationType: "OFFER", slug: "party-venue", parentId: null, isActive: true };
const camp = { publicationType: "OFFER", slug: "camp-city", parentId: null, isActive: true };
const placeRoot = { publicationType: "PLACE", slug: "playgrounds", parentId: null, isActive: true };
const placeChild = { publicationType: "PLACE", slug: "x", parentId: "root", isActive: true };
const partyScope = offerCategoryScopeForProductType("PARTY_PACKAGE")!;
const placeScope = offerCategoryScopeForProductType("PLACE_VISIT")!;
assert.equal(isCategoryInScope(partyScope, party), true);
assert.equal(isCategoryInScope(partyScope, camp), false);
assert.equal(isCategoryInScope(partyScope, placeRoot), false);
assert.equal(isCategoryInScope(placeScope, placeRoot), true);
assert.equal(isCategoryInScope(placeScope, placeChild), false);
assert.equal(isCategoryInScope(partyScope, { ...party, isActive: false }), false);
assert.equal(isCategoryInScope(partyScope, { ...party, archivedAt: new Date() }), false);

// форма списка: до 3, без дублей, порядок сохраняется
assert.deepEqual(checkCategoryIdsShape(["a", "b", "a"]), { ok: true, ids: ["a", "b"] });
assert.deepEqual(checkCategoryIdsShape([]), { ok: true, ids: [] });
assert.deepEqual(checkCategoryIdsShape(["a", "b", "c", "d"]), { ok: false, reason: "TOO_MANY" });
assert.deepEqual(checkCategoryIdsShape(["a", 1]), { ok: false, reason: "INVALID" });
assert.deepEqual(checkCategoryIdsShape(["  "]), { ok: false, reason: "INVALID" });
assert.deepEqual(checkCategoryIdsShape("a"), { ok: false, reason: "INVALID" });

console.log("offerCategories tests passed");
