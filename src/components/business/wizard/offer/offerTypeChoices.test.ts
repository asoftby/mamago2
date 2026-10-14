import assert from "node:assert/strict";
import {
  OFFER_CREATION_CATEGORIES,
  getOfferCreationCategory,
  getOfferTypeSelection,
} from "./offerTypeChoices";
import type { OfferProductType } from "./types";

const allTypes: OfferProductType[] = [
  "PLACE_VISIT",
  "ONE_TIME_ACTIVITY",
  "REGULAR_ACTIVITY",
  "CAMP",
  "PARTY_SERVICE",
  "PARTY_PACKAGE",
];

assert.equal(OFFER_CREATION_CATEGORIES.length, 4, "Four understandable categories");
const chosenTypes = OFFER_CREATION_CATEGORIES.flatMap((c) => c.options.map((o) => o.value));
assert.equal(new Set(chosenTypes).size, 6, "Each persisted type must appear once");
assert.deepEqual([...chosenTypes].sort(), [...allTypes].sort(), "No persisted types may disappear");

const expected = {
  PLACE_VISIT: ["place", "SINGLE", "WHERE_TO_GO", "service", null, "куда_пойти"],
  ONE_TIME_ACTIVITY: ["classes", "SINGLE", "WHERE_TO_GO", "course", "single", "куда_пойти"],
  REGULAR_ACTIVITY: ["classes", "REGULAR", "CLASSES", "course", "recurring", "занятия"],
  CAMP: ["camps", "CAMP", "CAMPS", "course", "camp", "занятия"],
  PARTY_SERVICE: ["parties", "SINGLE", "BIRTHDAY", "service", null, "день_рождения"],
  PARTY_PACKAGE: ["parties", "SINGLE", "BIRTHDAY", "birthday", null, "день_рождения"],
} as const;

for (const productType of allTypes) {
  const category = getOfferCreationCategory(productType);
  assert.ok(category, `Existing offer ${productType} has an editable category`);
  const selection = getOfferTypeSelection(productType);
  assert.deepEqual(
    [
      category.key,
      selection.offerWizardType,
      selection.requestedPlacements[0],
      selection.offerKind,
      selection.durationType,
      selection.intent,
    ],
    expected[productType],
    `Legacy wizard mapping unchanged for ${productType}`,
  );
}
assert.equal(getOfferCreationCategory(null), null);
console.log("Offer creation type choices tests passed");
