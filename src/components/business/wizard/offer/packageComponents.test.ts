import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require.extensions[".css"] = () => {};
const { validateForSubmit, validateStep } = require("./validation") as typeof import("./validation");
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

for (const partyPriceMode of ["ON_REQUEST", "FREE"] as const) {
  const data = { ...base, pricingMode: "single" as const, partyPriceMode, singlePrice: "" };
  assert.equal(validateStep(6, data).errors.includes("Укажите цену"), false);
  for (const variant of ["v1", "v2"] as const) assert.equal(validateForSubmit(data, variant).errors.includes("Укажите цену"), false);
}
const multiple = { ...base, pricingMode: "multiple" as const, partyPriceMode: "EXACT" as const,
  singlePrice: "999", pricingOptions: [{ id: "first", title: "First", price: "100", currency: "BYN" as const }, { id: "second", title: "Second", price: "200", currency: "BYN" as const }] };
assert.equal(buildOfferCreatePayload(multiple).partyPriceMode, undefined);
assert.equal(buildOfferUpdatePayload(multiple).partyPriceMode, undefined);
for (const file of ["src/app/api/business/offers/route.ts", "src/app/api/business/offers/[id]/route.ts"]) {
  assert.match(readFileSync(file, "utf8"), /data.pricingMode !== "MULTIPLE" &&/);
}
console.log("PASS numeric-free package validation and multi-option price precedence");
