import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDefaultFormData } from "./defaults";
import { buildOfferCreatePayload, buildOfferUpdatePayload, mapOfferToFormData, withSavedPackageComponents } from "./mappers";
import { isStepComplete, getMissingFieldsForStep } from "./offerWizardSteps.config";
import { Step2Placements } from "./steps/Step2Placements";
import { explicitWizardPrice, validatePartyWizardInput } from "@/lib/offers/partyWizardInput";

const restored = () => mapOfferToFormData({
  placeId: "place", kind: "SERVICE", productType: "PARTY_SERVICE", title: "Программа", description: "Описание",
  coverImage: null, priceFrom: 125.5, priceMode: "FROM", priceText: null, currency: "USD",
  agePolicy: "SPECIFIC", ageMinMonths: 67, ageMaxMonths: 83, interestSlugs: ["science"], category: "ANIMATOR",
  details: { durationMinutes: 90, included: "Реквизит", customLegacy: "keep", acceptsReferences: true },
});

test("create/update preserve exact age bounds, interests, currency, unknown details and semantic prices", () => {
  const data = restored();
  for (const build of [buildOfferCreatePayload, buildOfferUpdatePayload]) {
    const payload = build(data);
    assert.equal(payload.ageMinMonths, 67); assert.equal(payload.ageMaxMonths, 83);
    assert.equal(payload.currency, "USD"); assert.deepEqual(payload.interestSlugs, ["science"]);
    assert.equal(payload.priceMode, "FROM"); assert.equal(payload.singlePrice, 125.5);
    assert.equal((payload.details as Record<string, unknown>).customLegacy, "keep");
  }
  data.agePolicy = "ADULT_ONLY";
  assert.equal(buildOfferUpdatePayload(data).agePolicy, "ADULT_ONLY");
  data.birthdayDetails.acceptsReferences = null;
  assert.equal((buildOfferUpdatePayload(data).details as Record<string, unknown>).acceptsReferences, null);
});

test("invalid active amounts never become zero; hidden amounts do not block a request or another type", () => {
  const data = restored(); data.singlePrice = "12oops";
  assert.throws(() => buildOfferUpdatePayload(data), /цен/);
  for (const value of ["-1", "NaN", "12.123", "1e3", "Infinity"]) {
    data.singlePrice = value; assert.throws(() => buildOfferCreatePayload(data));
  }
  data.priceKind = "ON_REQUEST";
  assert.equal(buildOfferCreatePayload(data).singlePrice, undefined);
  assert.equal(isStepComplete("price", data, "v2"), true);
  assert.deepEqual(getMissingFieldsForStep("price", data, "v2"), []);
  data.productType = "PLACE_VISIT"; data.singlePrice = "150";
  assert.equal(buildOfferUpdatePayload(data).singlePrice, 150);
  data.productType = "PARTY_SERVICE"; data.priceKind = "EXACT"; data.singlePrice = "0";
  assert.equal(buildOfferCreatePayload(data).singlePrice, 0);
  assert.equal(explicitWizardPrice("EXACT", 12)?.mode, "EXACT");
  assert.equal(explicitWizardPrice("FROM", 12)?.mode, "FROM");
  assert.equal(explicitWizardPrice("ON_REQUEST")?.mode, "ON_REQUEST");
  assert.equal(explicitWizardPrice("EXACT")?.mode, "UNKNOWN");
});

test("changing party category retains hidden data and each of the eight scenarios renders", () => {
  const data = restored(); data.birthdayDetails.acceptsCustomOrders = true;
  const scenarios = ["VENUE", "ANIMATOR", "HOST", "SHOW", "MASTER_CLASS", "CAKE", "DECOR", "PACKAGE"] as const;
  for (const category of scenarios) {
    data.productType = category === "PACKAGE" ? "PARTY_PACKAGE" : "PARTY_SERVICE";
    data.partyCategory = category === "HOST" ? "ANIMATOR" : category === "PACKAGE" ? null : category;
    data.birthdayDetails.performerRole = category === "HOST" ? "HOST" : "ANIMATOR";
    const html = renderToStaticMarkup(createElement(Step2Placements, { data, onChange: () => {}, isEditable: true, v2: true }));
    assert.ok(html.includes("Что входит"), category);
    assert.equal((buildOfferUpdatePayload(data).details as Record<string, unknown>).acceptsCustomOrders, true);
    if (category === "CAKE" || category === "DECOR") assert.ok(html.includes("фотографии желаемого результата"));
    if (category === "HOST") assert.ok(html.includes("Ведущий"));
  }
});

test("second package save never restores the replaced legacy composition", () => {
  const data = restored(); data.productType = "PARTY_PACKAGE";
  data.persistedDetails = { includedCategories: ["CAKE"], customLegacy: "keep" };
  data.birthdayDetails.includedCategories = ["CAKE"];
  data.packageComponentsEdited = true;
  data.packageComponents = [{ title: "Зал", category: "VENUE" }];
  assert.equal((buildOfferUpdatePayload(data).details as Record<string, unknown>).includedCategories, undefined);
  const saved = withSavedPackageComponents(data, [{ id: "component", title: "Зал", category: "VENUE" }]);
  assert.equal(saved.packageComponentsEdited, false);
  assert.equal((buildOfferUpdatePayload(saved).details as Record<string, unknown>).includedCategories, undefined);
  assert.deepEqual(saved.packageComponentsBaseline, saved.packageComponents);
  assert.equal(buildOfferUpdatePayload(saved).packageComponents, undefined, "Unchanged composition is not rewritten");
});

test("backend rejects malformed category conditions while allowing unknown optional values", () => {
  validatePartyWizardInput({ productType: "PARTY_SERVICE", details: { durationMinutes: null, acceptsReferences: null } });
  assert.throws(() => validatePartyWizardInput({ productType: "PARTY_SERVICE", details: { durationMinutes: -5 } }));
  assert.throws(() => validatePartyWizardInput({ productType: "PARTY_PACKAGE", minChildren: 20, maxChildren: 2 }));
  assert.ok(getDefaultFormData("place"));
});

test("unchanged legacy numeric RANGE preserves both bounds without inventing variants", () => {
  const original = restored();
  const range = mapOfferToFormData({ placeId: "place", kind: "SERVICE", productType: "PARTY_SERVICE", title: "Range", description: "Range", coverImage: null,
    priceFrom: 100, priceTo: 250, priceMode: "RANGE", priceItems: null, priceText: null, agePolicy: "UNRESTRICTED", ageMinMonths: null, ageMaxMonths: null });
  const payload = buildOfferUpdatePayload(range);
  assert.equal(payload.pricingMode, undefined); assert.equal(payload.singlePrice, undefined); assert.equal(payload.priceMode, undefined);
  assert.equal(range.persistedPriceRange?.to, 250);
  range.priceKind = "EXACT"; range.singlePrice = original.singlePrice;
  assert.equal(buildOfferUpdatePayload(range).singlePrice, 125.5);
});

test("multiple-price preview uses the restored offer currency", () => {
  // The existing publication-access client barrel imports a phone stylesheet.
  require.extensions[".css"] = () => {};
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Step5Pricing } = require("./steps/Step5Pricing") as typeof import("./steps/Step5Pricing");
  const data = restored(); data.pricingMode = "multiple"; data.priceKind = "RANGE";
  data.pricingOptions = [{ id: "variant", title: "Программа", price: "150", oldPrice: "200", description: "" }];
  const html = renderToStaticMarkup(createElement(Step5Pricing, { data, onChange: () => {}, isEditable: true, hideCta: true }));
  assert.ok(html.includes("150 USD")); assert.ok(html.includes("200 USD"));
});

test("entering a price replaces legacy unknown/none/free semantics, while a currency edit does not", () => {
  require.extensions[".css"] = () => {};
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { singlePriceUpdates } = require("./steps/Step5Pricing") as typeof import("./steps/Step5Pricing");
  for (const kind of ["UNKNOWN", "NONE", "FREE"] as const) {
    const data = restored(); data.priceKind = kind; data.singlePrice = "";
    const edited = { ...data, ...singlePriceUpdates(data, "singlePrice", "150") };
    const payload = buildOfferUpdatePayload(edited);
    assert.equal(payload.priceMode, "EXACT"); assert.equal(payload.singlePrice, 150);
    assert.equal(singlePriceUpdates(data, "singleCurrency", "EUR").priceKind, undefined);
  }
  const from = restored();
  assert.equal(singlePriceUpdates(from, "singlePrice", "160").priceKind, undefined);
});
