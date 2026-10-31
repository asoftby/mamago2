import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (file: string) => readFileSync(file, "utf8");

test("new editor extends the existing offer wizard Services and Prices step", () => {
  const wizard = source("src/components/business/wizard/offer/OfferWizard.tsx");
  assert.match(wizard, /case "price":/);
  assert.match(wizard, /<Step5Pricing/);
  assert.match(wizard, /<BookingServicesEditor offerId=\{offerId\}/);
  const priceStep = source("src/components/business/wizard/offer/steps/Step5Pricing.tsx");
  assert.match(priceStep, /<ClassTariffsEditor/);
  assert.match(wizard, /showTariffs=\{variant !== "v2"\}/);
  const scheduleStep = source("src/components/business/wizard/offer/steps/StepClassSchedule.tsx");
  assert.match(scheduleStep, /showTariffs &&/);
  const tariffEditor = source("src/components/business/wizard/offer/components/ClassTariffsEditor.tsx");
  assert.match(tariffEditor, /classSchedule\.groups\.map/);
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

test("resource extras follow the canonical ON_REQUEST_WINDOWS booking schedule", () => {
  const service = source("src/server/offers/bookingServices.service.ts");
  assert.match(service, /scheduleKind !== "ON_REQUEST_WINDOWS"/);
  const editorApi = source("src/app/api/business/offers/[id]/booking-services/route.ts");
  assert.match(editorApi, /scheduleKind === "ON_REQUEST_WINDOWS"/);
  const catalog = source("src/app/api/public/offers/[id]/price-quote/route.ts");
  assert.match(catalog, /scheduleKind !== "ON_REQUEST_WINDOWS"/);
  const schedule = source("src/server/offers/offerSchedule.service.ts");
  assert.match(schedule, /Перед изменением расписания отключите допуслуги/);
});


test("party v2 schedule uses existing tenant-scoped booking unit API, not opening hours as slots", () => {
  const wizard = source("src/components/business/wizard/offer/OfferWizard.tsx");
  assert.match(wizard, /currentStepKey === "schedule"/);
  assert.match(wizard, /<PartyResourceSchedule offerId=\\{offerId\\}/);
  const editor = source("src/components/business/wizard/offer/components/PartyResourceSchedule.tsx");
  assert.match(editor, /\/api\/business\/booking-units/);
  assert.match(editor, /offerIds: \\[offerId\\]/);
  assert.match(editor, /minDurationMinutes: duration/);
  assert.match(editor, /rules: selected\\.map/);
  const api = source("src/app/api/business/booking-units/route.ts");
  assert.match(api, /bookingUnitCreateSchema\\.safeParse/);
  assert.match(api, /place: \\{ ownerBusinessId: businessId \\}/);
  assert.match(api, /type: "EXCLUSIVE"/);
});
