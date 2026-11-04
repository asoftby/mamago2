import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const menu = readFileSync("src/components/shared/CreatePublicationQuickMenu.tsx", "utf8");
const page = readFileSync("src/app/(content-editor)/editor/offer/new/page.tsx", "utf8");
const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");

test("business creation distinguishes the place profile from its visit offer", () => {
  for (const label of [
    "Мероприятие",
    "Добавить место",
    "Предложение о посещении",
    "Занятия и кружки",
    "Дни рождения и услуги",
    "Лагеря и каникулы",
  ]) {
    assert.ok(menu.includes(`label: "${label}"`), label);
  }
  assert.match(menu, /id: "visit-place",[\s\S]*?href: "\/editor\/place\/new"/);
  assert.match(menu, /id: "place-offer",[\s\S]*?href: "\/editor\/offer\/new\?creationIntent=place"/);
  assert.ok(menu.includes('publicationMode === "full"'));
  assert.ok(menu.includes(": BUSINESS_INTENTS"));
  assert.ok(menu.includes("currentSurfaceReturnTo"));
});

test("place creation stays available but is visually separated after offer intents", () => {
  const businessStart = menu.indexOf("const BUSINESS_INTENTS: Item[] = [");
  const businessEnd = menu.indexOf("\n];", businessStart);
  assert.ok(businessStart >= 0 && businessEnd > businessStart);
  const intents = menu.slice(businessStart, businessEnd);
  assert.ok(intents.indexOf('id: "visit-place"') > intents.indexOf('id: "camps"'));
  assert.match(intents, /id: "visit-place",[\s\S]*?label: "Добавить место"/);
  assert.match(menu, /item\.id === "visit-place" &&/);
  assert.match(menu, /role="separator"/);
  assert.match(menu, /aria-label=\{publicationMode === "business" \? "Добавить"/);
});

test("place visit offer uses the existing OFFER model and editor", () => {
  for (const intent of ["place", "classes", "parties", "camps"]) {
    assert.ok(menu.includes(`/editor/offer/new?creationIntent=${intent}`), intent);
    assert.ok(page.includes(`creationIntent === "${intent}"`), intent);
  }
  assert.match(wizard, /creationIntent === "place" \? "PLACE_VISIT"/);
  const info = readFileSync("src/components/business/wizard/offer/steps/Step2Information.tsx", "utf8");
  assert.match(info, /isClassOffer \|\| data\.productType === "PLACE_VISIT"/);
  assert.match(info, /<OfferCategoryPicker/);
  assert.ok(wizard.includes("...getOfferTypeSelection(selectedType)"));
  assert.match(wizard, /if \(mode !== "edit" \|\| !offer \|\| initialStepNumber == null \|\| initialStepNumber < 1\) \{[\s\S]*?return "type";/);
});

test("V2 subtype questions are selected once on step one for classes and parties", () => {
  assert.match(wizard, /const variant: OfferWizardVariant = activeOfferWizardVariant\(\);/);
  assert.ok(!wizard.includes("<OfferSubtypeClarifier"),
    "Universal V2 must not repeat class or party subtype questions on later steps");
  const typeStep = readFileSync("src/components/business/wizard/offer/steps/Step1Type.tsx", "utf8");
  assert.ok(typeStep.includes("activeCategory.options.map"), "Subtype options remain on V2 step one");
  assert.ok(typeStep.includes("getOfferTypeSelection"), "Selecting subtype updates the offer product type");
  assert.ok(wizard.includes('creationIntent === "classes" ? "REGULAR_ACTIVITY"'));
  assert.ok(wizard.includes('creationIntent === "parties" ? "PARTY_SERVICE"'));
});

test("business creation cards have equal height and two-line descriptions, without technical captions", () => {
  assert.ok(menu.includes('min-h-[104px] items-center'));
  assert.ok(menu.includes('line-clamp-2 min-h-10 max-w-[260px] leading-5'));
  assert.ok(!menu.includes('Создаёт Place'));
  assert.ok(!menu.includes('Создаёт Offer'));
});
