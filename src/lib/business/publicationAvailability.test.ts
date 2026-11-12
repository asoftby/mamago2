import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUSINESS_OFFERS_ENABLED, canBusinessCreateOffer } from "./publicationAvailability";

test("partner offer creation is paused while platform staff retain access", () => {
  assert.equal(BUSINESS_OFFERS_ENABLED, false);
  assert.equal(canBusinessCreateOffer("BUSINESS_OWNER"), false);
  assert.equal(canBusinessCreateOffer("USER"), false);
  assert.equal(canBusinessCreateOffer(undefined), false);
  assert.equal(canBusinessCreateOffer("ADMIN"), true);
  assert.equal(canBusinessCreateOffer("MODERATOR"), true);
});

test("business menu, onboarding, editor and API use the shared offer gate", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  assert.match(read("src/lib/business/navigation.ts"), /BUSINESS_OFFERS_ENABLED/);
  assert.match(read("src/components/shared/CreatePublicationQuickMenu.tsx"), /BUSINESS_OFFERS_ENABLED/);
  assert.match(read("src/components/business/dashboard/NewBusinessDashboard.tsx"), /VISIBLE_TYPES/);
  assert.match(read("src/app/business/(protected)/offers/OffersList.tsx"), /allowCreate=\{BUSINESS_OFFERS_ENABLED\}/);
  assert.match(read("src/app/(content-editor)/editor/offer/new/page.tsx"), /canBusinessCreateOffer\(user.role\)/);
  assert.match(read("src/app/api/business/offers/route.ts"), /canBusinessCreateOffer\(user.role\)/);
});
