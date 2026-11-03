import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const menu = readFileSync("src/components/shared/CreatePublicationQuickMenu.tsx", "utf8");
const page = readFileSync("src/app/(content-editor)/editor/offer/new/page.tsx", "utf8");
const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");

test("business creation distinguishes the place profile from its visit offer", () => {
  for (const label of [
    "Мероприятие",
    "Страница места",
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

test("place visit offer uses the existing OFFER model and editor", () => {
  for (const intent of ["place", "classes", "parties", "camps"]) {
    assert.ok(menu.includes(`/editor/offer/new?creationIntent=${intent}`), intent);
    assert.ok(page.includes(`creationIntent === "${intent}"`), intent);
  }
  assert.match(wizard, /creationIntent === "place" \? "PLACE_VISIT"/);
  assert.ok(wizard.includes("...getOfferTypeSelection(selectedType)"));
  assert.match(wizard, /variant === "v2" \? "about" : creationIntent === "parties" \? "placements" : "details"/);
});

test("subtype questions stay available for classes and parties", () => {
  assert.ok(wizard.includes('creationIntent === "classes" && ('));
  assert.ok(wizard.includes('creationIntent === "parties" && ('));
  assert.ok(wizard.includes("<OfferSubtypeClarifier group={creationIntent}"));
  const clarifier = readFileSync("src/components/business/wizard/offer/components/OfferSubtypeClarifier.tsx", "utf8");
  for (const type of ["ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY", "PARTY_SERVICE", "PARTY_PACKAGE"]) {
    assert.ok(clarifier.includes(type));
  }
  assert.ok(clarifier.includes("...getOfferTypeSelection(item.type)"));
  assert.ok(!clarifier.includes("categoryIds: []"));
});
