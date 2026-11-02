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
