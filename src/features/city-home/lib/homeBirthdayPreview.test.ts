import assert from "node:assert/strict";
import test from "node:test";
import { selectHomeBirthdayOffers } from "./homeBirthdayPreview";
import type { BirthdayCatalogItem, PartyCategoryKey } from "@/features/birthday/builder/lib/realCatalog";

function fixture(id: string, productType: BirthdayCatalogItem["productType"], category: PartyCategoryKey | null): BirthdayCatalogItem {
  return { id, title: id, productType, category, businessId: "biz", businessName: "test",
    placeId: "place", placeTitle: "test", coverImage: null, priceFrom: 10, priceMode: "FROM", currency: "BYN",
    ageMinMonths: null, ageMaxMonths: null, minChildren: null, maxChildren: null,
    locationType: "BOTH", includedCategories: [], prepaymentTerms: null, cancellationTerms: null };
}

test("home birthday preview includes packages and distinct service categories", () => {
  const categories: PartyCategoryKey[] = ["VENUE", "ANIMATOR", "SHOW", "MASTER_CLASS", "CAKE", "FOOD", "DECOR", "PHOTO", "PROGRAM", "OTHER"];
  const items = [fixture("pkg1", "PARTY_PACKAGE", null), fixture("pkg2", "PARTY_PACKAGE", null),
    ...categories.flatMap(cat => Array.from({ length: 5 }, (_, i) => fixture(cat + i, "PARTY_SERVICE", cat)))];
  const result = selectHomeBirthdayOffers(items);
  assert.equal(result.length, 12);
  assert.equal(result.filter(x => x.productType === "PARTY_PACKAGE").length, 2);
  assert.equal(new Set(result.filter(x => x.category).map(x => x.category)).size, 10);
});

test("empty catalog stays empty and sparse categories can fill remaining positions", () => {
  assert.deepEqual(selectHomeBirthdayOffers([]), []);
  const items = Array.from({ length: 5 }, (_, i) => fixture("cake"+i, "PARTY_SERVICE", "CAKE"));
  assert.equal(selectHomeBirthdayOffers(items).length, 5);
});
