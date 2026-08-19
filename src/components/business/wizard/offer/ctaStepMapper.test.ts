import * as assert from "node:assert/strict";

import { OfferCtaAdapter } from "@/lib/cta-platform";
import { getDefaultFormData } from "./defaults";
import {
  mapCtaStepValueToOfferFormPatch,
  mapCtaStepValueToOfferLegacy,
  mapOfferFormDataToCtaStepValue,
  mapOfferLegacyCtaToStepValue,
  type OfferLegacyCtaFields,
} from "./ctaStepMapper";

function createLegacyInput(
  overrides: Partial<OfferLegacyCtaFields>,
): OfferLegacyCtaFields {
  return {
    id: overrides.id ?? "offer-test",
    ctaType: overrides.ctaType ?? null,
    ctaPhone: overrides.ctaPhone ?? "",
    ctaLink: overrides.ctaLink ?? "",
    ctaInstructions: overrides.ctaInstructions ?? "",
    bookingEnabled: overrides.bookingEnabled ?? false,
    bookingMode: overrides.bookingMode ?? null,
    bookingPhone: overrides.bookingPhone ?? "",
    bookingNote: overrides.bookingNote ?? "",
  };
}

function assertCanonicalParity(input: OfferLegacyCtaFields) {
  const mapped = mapOfferLegacyCtaToStepValue(input);
  const roundtrip = mapCtaStepValueToOfferLegacy(mapped, { id: input.id });

  const before = OfferCtaAdapter.toCanonical(input);
  const after = OfferCtaAdapter.toCanonical(roundtrip);

  assert.equal(after.actionKind, before.actionKind);
  assert.equal(after.executionKind, before.executionKind);
  assert.equal(after.primaryLabel, before.primaryLabel);
  assert.equal(after.instructions ?? "", before.instructions ?? "");
  assert.equal(after.externalTarget?.href ?? "", before.externalTarget?.href ?? "");
  assert.equal(
    after.requestConfig?.selectionMode ?? "NONE",
    before.requestConfig?.selectionMode ?? "NONE",
  );
  assert.equal(
    after.contactFallback?.[0]?.href ?? "",
    before.contactFallback?.[0]?.href ?? "",
  );
}

const bookingRequestOnly = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "booking-request-only",
    bookingEnabled: true,
    bookingMode: "REQUEST_ONLY",
    bookingPhone: "+375291112245",
    bookingNote: "Coordinator will confirm",
  }),
);
assert.equal(bookingRequestOnly.actionChoice, "REQUEST");
assert.equal(bookingRequestOnly.requestMode, "SIMPLE");
assert.equal(bookingRequestOnly.requestLabelKind, "BOOK");
assert.equal(bookingRequestOnly.legacyOrigin, "BOOKING");
assert.equal(bookingRequestOnly.fallback.phone, "+375291112245");
assert.equal(bookingRequestOnly.instructions, "Coordinator will confirm");

const bookingDates = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "booking-dates",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_DATES",
    bookingPhone: "+375291112244",
    bookingNote: "Choose a date",
  }),
);
assert.equal(bookingDates.actionChoice, "REQUEST");
assert.equal(bookingDates.requestMode, "CALENDAR");
assert.equal(bookingDates.calendarMode, "DATE_ONLY");
assert.equal(bookingDates.legacyOrigin, "BOOKING");

const bookingSlots = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "booking-slots",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_SLOTS",
    bookingPhone: "+375291112246",
  }),
);
assert.equal(bookingSlots.actionChoice, "REQUEST");
assert.equal(bookingSlots.requestMode, "CALENDAR");
assert.equal(bookingSlots.calendarMode, "DATE_AND_TIME");

const requestCta = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "request-cta",
    ctaType: "отправить_заявку",
    ctaInstructions: "We will call back",
  }),
);
assert.equal(requestCta.actionChoice, "REQUEST");
assert.equal(requestCta.requestMode, "SIMPLE");
assert.equal(requestCta.requestLabelKind, "REQUEST");
assert.equal(requestCta.legacyOrigin, "CTA");
assert.equal(requestCta.instructions, "We will call back");

const campScheduleFallback = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "camp-schedule-fallback",
    ctaType: "записаться",
  }),
);
assert.equal(campScheduleFallback.actionChoice, "REQUEST");
assert.equal(campScheduleFallback.requestMode, "SIMPLE");
assert.equal(campScheduleFallback.requestLabelKind, "BOOK");
assert.equal(campScheduleFallback.legacyOrigin, "CTA");

const externalSite = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "external-site",
    ctaType: "перейти_на_сайт",
    ctaLink: "https://example.com/program",
    ctaInstructions: "Open provider website",
  }),
);
assert.equal(externalSite.actionChoice, "EXTERNAL");
assert.equal(externalSite.externalKind, "SITE");
assert.equal(externalSite.externalUrl, "https://example.com/program");
assert.equal(externalSite.instructions, "Open provider website");

const externalTickets = mapOfferLegacyCtaToStepValue(
  createLegacyInput({
    id: "external-tickets",
    ctaType: "купить_билет",
    ctaLink: "https://tickets.example.com/program",
  }),
);
assert.equal(externalTickets.actionChoice, "EXTERNAL");
assert.equal(externalTickets.externalKind, "TICKETS");

const reverseBookingRequestOnly = mapCtaStepValueToOfferLegacy(bookingRequestOnly, {
  id: "booking-request-only",
});
assert.equal(reverseBookingRequestOnly.bookingEnabled, true);
assert.equal(reverseBookingRequestOnly.bookingMode, "REQUEST_ONLY");
assert.equal(reverseBookingRequestOnly.bookingPhone, "+375291112245");
assert.equal(reverseBookingRequestOnly.bookingNote, "Coordinator will confirm");

const reverseBookingDates = mapCtaStepValueToOfferLegacy(bookingDates, {
  id: "booking-dates",
});
assert.equal(reverseBookingDates.ctaType, "забронировать");
assert.equal(reverseBookingDates.bookingEnabled, true);
assert.equal(reverseBookingDates.bookingMode, "USE_PUBLICATION_DATES");

const reverseBookingSlots = mapCtaStepValueToOfferLegacy(bookingSlots, {
  id: "booking-slots",
});
assert.equal(reverseBookingSlots.bookingEnabled, true);
assert.equal(reverseBookingSlots.bookingMode, "USE_PUBLICATION_SLOTS");

const reverseRequestCta = mapCtaStepValueToOfferLegacy(requestCta, {
  id: "request-cta",
});
assert.equal(reverseRequestCta.ctaType, "отправить_заявку");
assert.equal(reverseRequestCta.ctaPhone, "");
assert.equal(reverseRequestCta.bookingEnabled, false);

const reverseCampFallback = mapCtaStepValueToOfferLegacy(campScheduleFallback, {
  id: "camp-schedule-fallback",
});
assert.equal(reverseCampFallback.ctaType, "записаться");
assert.equal(reverseCampFallback.bookingEnabled, false);

const reverseExternalSite = mapCtaStepValueToOfferLegacy(externalSite, {
  id: "external-site",
});
assert.equal(reverseExternalSite.ctaType, "перейти_на_сайт");
assert.equal(reverseExternalSite.ctaLink, "https://example.com/program");

const incompleteDateTimeSelection = {
  ...bookingSlots,
  calendarDays: [
    {
      ...bookingSlots.calendarDays[0],
      date: "",
      slots: bookingSlots.calendarDays[0]?.slots ?? [],
    },
  ],
};
const incompleteDateTimePatch = mapCtaStepValueToOfferFormPatch(
  incompleteDateTimeSelection,
  { id: "booking-slots-incomplete" },
);
const incompleteDateTimeFormData = {
  ...getDefaultFormData(),
  ...incompleteDateTimePatch,
  ctaType: incompleteDateTimePatch.ctaType ?? null,
  ctaPhone: incompleteDateTimePatch.ctaPhone ?? "",
  ctaLink: incompleteDateTimePatch.ctaLink ?? "",
  ctaInstructions: incompleteDateTimePatch.ctaInstructions ?? "",
  bookingSettings: incompleteDateTimePatch.bookingSettings ?? getDefaultFormData().bookingSettings,
};
const restoredIncompleteDateTime = mapOfferFormDataToCtaStepValue(
  incompleteDateTimeFormData,
  { id: "booking-slots-incomplete" },
);
assert.equal(restoredIncompleteDateTime.actionChoice, "REQUEST");
assert.equal(restoredIncompleteDateTime.requestMode, "CALENDAR");
assert.equal(restoredIncompleteDateTime.calendarMode, "DATE_AND_TIME");

assertCanonicalParity(
  createLegacyInput({
    id: "parity-request-only",
    bookingEnabled: true,
    bookingMode: "REQUEST_ONLY",
    bookingPhone: "+375291100001",
    bookingNote: "Coordinator will confirm",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-dates",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_DATES",
    bookingPhone: "+375291100002",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-slots",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_SLOTS",
    bookingPhone: "+375291100003",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-request-cta",
    ctaType: "отправить_заявку",
    ctaInstructions: "We will call back",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-camp-fallback",
    ctaType: "записаться",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-external-site",
    ctaType: "перейти_на_сайт",
    ctaLink: "https://example.com/program",
    ctaInstructions: "Open provider website",
  }),
);

console.log("offer cta step mapper tests: OK");
