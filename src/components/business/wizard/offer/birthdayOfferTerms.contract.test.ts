import assert from "node:assert/strict";
import { AgePolicy } from "@prisma/client";
import { getDefaultFormData } from "./defaults";
import { buildOfferCreatePayload, buildOfferUpdatePayload, mapOfferToFormData } from "./mappers";
import { serviceDetails, packageDetails } from "@/lib/offers/offer-types/details-schemas";

for (const productType of ["PARTY_SERVICE", "PARTY_PACKAGE"] as const) {
  const draft = getDefaultFormData("test-place");
  draft.offerWizardType = "SINGLE";
  draft.productType = productType;
  draft.birthdayDetails.included = "Ведущий, зал, торт";
  draft.birthdayDetails.durationMinutes = productType === "PARTY_PACKAGE" ? 120 : 150;
  draft.birthdayDetails.minChildren = 5;
  draft.birthdayDetails.maxChildren = 12;
  draft.birthdayDetails.prepaymentTerms = "30% после подтверждения";
  draft.birthdayDetails.cancellationTerms = "Возврат при отмене за 7 дней";
  if (productType === "PARTY_PACKAGE") draft.birthdayDetails.includedCategories = ["VENUE", "CAKE"];
  if (productType === "PARTY_SERVICE") draft.partyCategory = "CAKE";

  const create = buildOfferCreatePayload(draft);
  const update = buildOfferUpdatePayload(draft);
  assert.deepEqual(create.details, update.details, productType);
  const schema = productType === "PARTY_PACKAGE" ? packageDetails : serviceDetails;
  assert.equal(schema.safeParse(create.details).success, true, productType);

  const roundtrip = mapOfferToFormData({
    placeId: "test-place",
    kind: "SERVICE",
    productType,
    title: "Праздничное предложение",
    description: "Описание праздничного предложения",
    coverImage: null,
    priceFrom: 250,
    priceMode: "EXACT",
    priceText: null,
    ageMinMonths: null,
    ageMaxMonths: null,
    agePolicy: AgePolicy.UNRESTRICTED,
    details: create.details,
    category: productType === "PARTY_SERVICE" ? "CAKE" : null,
    minChildren: 5,
    maxChildren: 12,
  });
  assert.equal(roundtrip.birthdayDetails.durationMinutes, draft.birthdayDetails.durationMinutes);
  assert.equal(roundtrip.birthdayDetails.minChildren, 5);
  assert.equal(roundtrip.birthdayDetails.maxChildren, 12);
  assert.equal(Reflect.get(create, "minChildren"), 5);
  assert.equal(Reflect.get(create, "maxChildren"), 12);
  assert.equal(Reflect.get(update, "minChildren"), 5);
  assert.equal(Reflect.get(update, "maxChildren"), 12);
  assert.equal(roundtrip.birthdayDetails.prepaymentTerms, draft.birthdayDetails.prepaymentTerms);
  assert.equal(roundtrip.birthdayDetails.cancellationTerms, draft.birthdayDetails.cancellationTerms);
  assert.deepEqual(roundtrip.birthdayDetails.includedCategories, draft.birthdayDetails.includedCategories);
}
console.log("birthdayOfferTerms.contract.test.ts: OK");
