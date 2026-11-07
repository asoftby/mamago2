import assert from "node:assert/strict";
import { getDefaultFormData } from "./defaults";
import { buildOfferCreatePayload, buildOfferUpdatePayload } from "./mappers";
import { packageComponentInputSchema, validatePackageCredits } from "@/server/offers/packageComponents";

const base = {
  ...getDefaultFormData("test-place"), offerWizardType: "SINGLE" as const, productType: "PARTY_PACKAGE" as const,
  title: "Пакет", singlePrice: "500", packageComponents: [{
    title: "Декор", category: "DECOR" as const, removalPolicy: "REMOVABLE_FIXED_CREDIT" as const, removalCreditByn: "50.00",
  }], packageComponentsBaseline: [],
};
for (const mode of ["EXACT", "FROM", "ON_REQUEST"] as const) {
  const data = { ...base, partyPriceMode: mode };
  assert.equal(buildOfferCreatePayload(data).partyPriceMode, mode);
  assert.equal(buildOfferUpdatePayload(data).partyPriceMode, mode);
  assert.equal(buildOfferCreatePayload({ ...data, packageComponents: undefined }).partyPriceMode, mode);
  assert.equal(buildOfferUpdatePayload({ ...data, packageComponents: undefined }).partyPriceMode, mode);
}
const rows = packageComponentInputSchema.parse(base.packageComponents);
assert.doesNotThrow(() => validatePackageCredits(rows, "EXACT", 500));
assert.throws(() => validatePackageCredits(rows, "FROM", 500));
assert.throws(() => validatePackageCredits(rows, "EXACT", 49));
assert.equal((buildOfferUpdatePayload(base).details as Record<string, unknown> | undefined)?.includedCategories, undefined);
console.log("PASS package rules payload and price semantics");
