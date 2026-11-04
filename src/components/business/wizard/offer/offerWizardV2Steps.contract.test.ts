import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDefaultFormData } from "./defaults";
import { partyCategoryFromOfferCategorySlug } from "./offerTypeChoices";
import { V2_STEPS, V2_STEP_KEYS, getV2StepMembers, isV2CompositeStepKey } from "./offerWizardV2Steps";
import { getNextStepKey, getStepsForOfferType, isStepComplete } from "./offerWizardSteps.config";

const V2_KEYS = ["type", "about", "services", "schedule", "terms", "review"];

{
  // новый мастер: ровно 6 шагов в нужном порядке; составные — about/services/schedule/terms
  assert.deepEqual(V2_STEPS.map((s) => s.key), V2_KEYS);
  assert.deepEqual([...V2_STEP_KEYS], ["about", "services", "schedule", "terms"]);
  assert.ok(isV2CompositeStepKey("about"));
  assert.ok(!isV2CompositeStepKey("type"));
  assert.ok(!isV2CompositeStepKey("review"));
  for (const step of V2_STEPS) {
    assert.ok(step.title && step.shortLabel, `step ${step.key} has labels`);
  }
}

{
  // состав составных шагов
  const base = getDefaultFormData(null);
  assert.deepEqual(getV2StepMembers("about", { ...base, productType: "ONE_TIME_ACTIVITY" }), ["details", "photo"]);
  assert.deepEqual(getV2StepMembers("about", { ...base, productType: "PARTY_PACKAGE" }), ["placements", "details", "photo"]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, offerWizardType: "CAMP" }), ["campSchedule", "accommodation", "bookingMethod"]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "PARTY_SERVICE" }), ["openingHours", "bookingMethod"]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "REGULAR_ACTIVITY" }), [
    "conditions",
    "classSchedule",
    "bookingMethod",
  ]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "ONE_TIME_ACTIVITY" }), [
    "conditions",
    "classSchedule",
    "bookingMethod",
  ]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "PLACE_VISIT" }), [
    "conditions",
    "openingHours",
    "bookingMethod",
  ]);
  assert.deepEqual(getV2StepMembers("services", base), ["price"]);
  assert.deepEqual(getV2StepMembers("terms", base), ["contacts"]);
}

// Regular lessons must create a schedule group before the group tariff can be
// configured. All routes still use exactly six V2 steps without flag gating.
{
  const regular = getStepsForOfferType("REGULAR", "REGULAR_ACTIVITY", "v2");
  assert.deepEqual(regular.map((s) => s.key),
    ["type", "about", "schedule", "services", "terms", "review"]);
  assert.equal(getNextStepKey("REGULAR", "about", "REGULAR_ACTIVITY", "v2"), "schedule");
  assert.equal(getNextStepKey("REGULAR", "schedule", "REGULAR_ACTIVITY", "v2"), "services");
  const form = getDefaultFormData(null);
  form.offerWizardType = "REGULAR";
  form.productType = "REGULAR_ACTIVITY";
  assert.equal(form.schedule.classSchedule.groups.length, 0);
  assert.equal(isStepComplete("services", form, "v2"), false,
    "Pricing cannot be marked complete before the user creates a group");
  for (const [type, product] of [
    ["SINGLE", "ONE_TIME_ACTIVITY"],
    ["CAMP", "CAMP"],
    ["SINGLE", "PLACE_VISIT"],
    ["SINGLE", "PARTY_SERVICE"],
    ["SINGLE", "PARTY_PACKAGE"],
  ] as const) {
    assert.deepEqual(
      getStepsForOfferType(type, product, "v2").map((s) => s.key),
      V2_KEYS, `${product}: unchanged six-step order`);
  }
}
console.log("offerWizardV2Steps contract tests passed");

{
  // Booking policies across all four routes: assert exact composition and
  // distinguish party opening hours from actual availability.
  const base = getDefaultFormData(null);
  const routes = [
    { data: { ...base, productType: "PLACE_VISIT" as const }, steps: ["conditions", "openingHours", "bookingMethod"] },
    { data: { ...base, productType: "REGULAR_ACTIVITY" as const }, steps: ["conditions", "classSchedule", "bookingMethod"] },
    { data: { ...base, productType: "PARTY_PACKAGE" as const }, steps: ["openingHours", "bookingMethod"] },
    { data: { ...base, offerWizardType: "CAMP" as const, productType: "CAMP" as const }, steps: ["campSchedule", "accommodation", "bookingMethod"] },
  ];
  for (const route of routes) {
    assert.deepEqual(getV2StepMembers("schedule", route.data), route.steps);
    assert.deepEqual(getV2StepMembers("services", route.data), ["price"]);
  }

  const method = readFileSync("src/components/business/wizard/offer/steps/StepBookingMethod.tsx", "utf8");
  assert.match(method, /isParty &&/);
  assert.match(method, /не создают доступные для бронирования слоты/);
  assert.match(method, /По заявке.*не подтверждает свободное время автоматически/);
  const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
  assert.ok(wizard.includes("<BookingServicesEditor offerId={offerId}"));
  // V2 keeps the main offer in one flow; operational editors load on demand.
  assert.ok(wizard.includes("const handleSaveDraft = async (continueOnCurrentStep = false) =>"));
  assert.ok(wizard.includes('router.replace(`${editorOfferEditHref(data.id)}?step=${currentStepNum}`);'));
  assert.ok(wizard.includes("setAdvancedServicesOpen(true)"));
  assert.ok(wizard.includes("setPartyScheduleOpen(true)"));
  assert.ok(!wizard.includes('currentStepKey === "about" && mode === "create"'),
    "V2 must not repeat the subtype already chosen on step one");
  const classSchedule = readFileSync("src/components/business/wizard/offer/steps/StepClassSchedule.tsx", "utf8");
  assert.ok(classSchedule.includes("classSchedule.groups.map"));
}

{
  // Step one persists BOTH the searchable categoryId and the single-party type.
  for (const [slug, expected] of [
    ["party-venue", "VENUE"], ["party-animator", "ANIMATOR"],
    ["party-show", "SHOW"], ["party-master-class", "MASTER_CLASS"],
    ["party-cake", "CAKE"], ["party-food", "FOOD"],
    ["party-decor", "DECOR"], ["party-photo", "PHOTO"],
    ["party-program", "PROGRAM"], ["party-other", "OTHER"],
  ]) {
    assert.equal(partyCategoryFromOfferCategorySlug(slug), expected, slug);
  }
  assert.equal(partyCategoryFromOfferCategorySlug("party-future-category"), null);
  const stepOne = readFileSync("src/components/business/wizard/offer/steps/Step1Type.tsx", "utf8");
  assert.ok(stepOne.includes('maxSelected={data.productType === "PARTY_SERVICE" ? 1 : undefined}'));
  assert.ok(stepOne.includes("partyCategoryFromOfferCategorySlug(option.slug)"));
}
