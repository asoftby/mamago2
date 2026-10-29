import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (file: string) => readFileSync(file, "utf8");

test("new editor extends the existing offer wizard Services and Prices step", () => {
  const wizard = source("src/components/business/wizard/offer/OfferWizard.tsx");
  assert.match(wizard, /case "price":/);
  assert.match(wizard, /<Step5Pricing/);
  assert.match(wizard, /<BookingServicesEditor offerId=\{offerId\}/);
  const editor = source("src/components/business/wizard/offer/components/BookingServicesEditor.tsx");
  assert.match(editor, /Сохранить услуги и стоимость/);
  assert.match(editor, /pricingRevision|revision: catalog\.revision/);
});

test("public options, quote and reservation share the same existing booking overlay", () => {
  const overlay = source("src/components/offers/ClassBookingOverlay.tsx");
  assert.match(overlay, /selectedOptionIds/);
  assert.match(overlay, /price-quote/);
  assert.match(overlay, /quoteLoading \|\| !priceQuote/);
  assert.match(overlay, /selectedOptionIds,\s*seats/);
  const quote = source("src/app/api/public/offers/[id]/price-quote/route.ts");
  assert.match(quote, /bookingUnitId: _internal/);
  assert.match(quote, /mode !== "STANDALONE"/);
  const reserve = source("src/app/api/public/offers/[id]/reserve/route.ts");
  assert.match(reserve, /selectedOptionIds: payload\.data\.selectedOptionIds/);
});

test("pricing mutations require owner, CAS revision and linked business inventory", () => {
  const api = source("src/app/api/business/offers/[id]/booking-services/route.ts");
  assert.match(api, /canManagePlaceAsync\(user, offer\.place\)/);
  assert.match(api, /saveBookingServices/);
  const command = source("src/server/offers/bookingServices.service.ts");
  assert.match(command, /FOR UPDATE/);
  assert.match(command, /pricingRevision: data\.revision/);
  assert.match(command, /bookingUnit: \{ businessId, type: "EXCLUSIVE", status: "ACTIVE" \}/);
  assert.match(command, /current\.place|offer\.place\?\.ownerBusinessId !== businessId/);
});
