import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/shared/CreatePublicationQuickMenu.tsx", "utf8");

test("business creation shows family-facing intents, not Event/Offer model choices", () => {
  for (const label of [
    "Мероприятие",
    "Место для посещения",
    "Занятия и кружки",
    "Дни рождения и услуги",
    "Лагеря и каникулы",
  ]) {
    assert.ok(source.includes(`label: "${label}"`));
  }
  assert.ok(source.includes('publicationMode === "full"'));
  assert.ok(source.includes(": BUSINESS_INTENTS"));
});

test("business intent routing reuses current editors, without writes or duplicates", () => {
  assert.ok(source.includes('href: "/editor/event/new"'));
  assert.ok(source.includes('href: "/editor/place/new"'));
  assert.ok(source.includes('href: "/editor/offer/new"'));
  assert.ok(source.includes("currentSurfaceReturnTo"));
});

test("business intent preselects offer type without creating another entity", () => {
  for (const intent of ["classes", "parties", "camps"]) {
    assert.ok(source.includes(`/editor/offer/new?creationIntent=${intent}`));
  }
  const page = readFileSync("src/app/(content-editor)/editor/offer/new/page.tsx", "utf8");
  assert.ok(page.includes("creationIntent={creationIntent"));
  const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
  assert.ok(wizard.includes('creationIntent === "classes" ? "REGULAR_ACTIVITY"'));
  assert.ok(wizard.includes('creationIntent === "parties" ? "PARTY_SERVICE"'));
  assert.ok(wizard.includes('creationIntent === "camps" ? "CAMP"'));
  assert.ok(wizard.includes('creationIntent ? "about" : "type"'));
});

test("subtype choices preserve shared content and remain on the About step", () => {
  const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
  assert.ok(wizard.includes("<OfferSubtypeClarifier group={creationIntent}"));
  const clarifier = readFileSync("src/components/business/wizard/offer/components/OfferSubtypeClarifier.tsx", "utf8");
  for (const type of ["ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY", "PARTY_SERVICE", "PARTY_PACKAGE"]) {
    assert.ok(clarifier.includes(type));
  }
  assert.ok(clarifier.includes("...getOfferTypeSelection(item.type)"));
  assert.ok(!clarifier.includes("categoryIds: []"));
});
