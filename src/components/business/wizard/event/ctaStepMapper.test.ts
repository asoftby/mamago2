import * as assert from "node:assert/strict";

import { EventCtaAdapter } from "@/lib/cta-platform";
import { getDefaultFormData } from "./defaults";
import { DEFAULT_ACTIVITY_FORMAT } from "@/domain/activities/activity-format";
import { buildEventPayload, mapEventToFormData, type ActivityWithRelations } from "./mappers";
import {
  mapCtaStepValueToEventFormPatch,
  mapCtaStepValueToEventLegacy,
  mapEventFormDataToCtaStepValue,
  mapEventLegacyCtaToStepValue,
  type EventLegacyCtaFields,
} from "./ctaStepMapper";

function createLegacyInput(
  overrides: Partial<EventLegacyCtaFields>,
): EventLegacyCtaFields {
  return {
    id: overrides.id ?? "event-test",
    participationMode: overrides.participationMode ?? null,
    ticketLink: overrides.ticketLink ?? "",
    prebookMethod: overrides.prebookMethod ?? null,
    prebookPhone: overrides.prebookPhone ?? "",
    prebookUrl: overrides.prebookUrl ?? "",
    timeSlots: overrides.timeSlots ?? { dates: [] },
    simpleBookingDate: overrides.simpleBookingDate ?? null,
    simpleBookingTime: overrides.simpleBookingTime ?? null,
    simpleBookingCapacity: overrides.simpleBookingCapacity ?? null,
    bookingEnabled: overrides.bookingEnabled ?? false,
    bookingMode: overrides.bookingMode ?? null,
    bookingPhone: overrides.bookingPhone ?? "",
    bookingNote: overrides.bookingNote ?? "",
  };
}

function assertCanonicalParity(input: EventLegacyCtaFields) {
  const mapped = mapEventLegacyCtaToStepValue(input);
  const roundtrip = mapCtaStepValueToEventLegacy(mapped, { id: input.id });

  const before = EventCtaAdapter.toCanonical(input);
  const after = EventCtaAdapter.toCanonical(roundtrip);

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

const externalLink = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-external-link",
    participationMode: "external-link",
    ticketLink: "https://tickets.example.com/event",
  }),
);
assert.equal(externalLink.actionChoice, "EXTERNAL");
assert.equal(externalLink.externalKind, "TICKETS");
assert.equal(externalLink.externalUrl, "https://tickets.example.com/event");
assert.equal(externalLink.legacyOrigin, "CTA");

const prebookPhone = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-prebook-phone",
    participationMode: "prebook",
    prebookMethod: "phone",
    prebookPhone: "+375291112233",
    bookingNote: "Call to confirm",
  }),
);
assert.equal(prebookPhone.actionChoice, "REQUEST");
assert.equal(prebookPhone.requestMode, "SIMPLE");
assert.equal(prebookPhone.requestLabelKind, "BOOK");
assert.equal(prebookPhone.legacyOrigin, "BOOKING");
assert.equal(prebookPhone.fallback.phone, "+375291112233");
assert.equal(prebookPhone.instructions, "Call to confirm");

const prebookLink = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-prebook-link",
    participationMode: "prebook",
    prebookMethod: "link",
    prebookUrl: "https://example.com/prebook",
  }),
);
assert.equal(prebookLink.actionChoice, "REQUEST");
assert.equal(prebookLink.requestMode, "SIMPLE");
assert.equal(prebookLink.requestLabelKind, "BOOK");
assert.equal(prebookLink.legacyOrigin, "BOOKING");
assert.equal(prebookLink.fallback.website, "https://example.com/prebook");

const timeSlots = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-time-slots",
    participationMode: "time-slots",
    timeSlots: {
      dates: [
        {
          id: "date-1",
          isoDate: "2026-07-11",
          label: "2026-07-11",
          slots: [
            {
              id: "slot-1",
              startTime: "10:00",
              endTime: "11:00",
              capacity: 8,
            },
          ],
        },
      ],
    },
  }),
);
assert.equal(timeSlots.actionChoice, "REQUEST");
assert.equal(timeSlots.requestMode, "CALENDAR");
assert.equal(timeSlots.calendarMode, "DATE_AND_TIME");
assert.equal(timeSlots.legacyOrigin, "CTA");
assert.equal(timeSlots.calendarDays[0]?.date, "2026-07-11");
assert.equal(timeSlots.calendarDays[0]?.slots[0]?.startTime, "10:00");

const simpleBooking = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-simple-booking",
    participationMode: "simple-booking",
    simpleBookingDate: "2026-07-11",
    simpleBookingTime: "10:00-11:00",
    simpleBookingCapacity: 12,
  }),
);
assert.equal(simpleBooking.actionChoice, "REQUEST");
assert.equal(simpleBooking.requestMode, "SIMPLE");
assert.equal(simpleBooking.requestLabelKind, "BOOK");
assert.equal(simpleBooking.legacyOrigin, "CTA");

const request = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-request",
    participationMode: "request",
  }),
);
assert.equal(request.actionChoice, "DISCOVER");
assert.equal(request.legacyOrigin, "BOOKING");
assert.equal(request.requestLabelKind, "REQUEST");

const walkIn = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-walk-in",
    participationMode: "walk-in",
  }),
);
assert.equal(walkIn.actionChoice, "DISCOVER");
assert.equal(walkIn.legacyOrigin, "CTA");
assert.equal(walkIn.requestLabelKind, "BOOK");

const infoOnly = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-info-only",
    participationMode: "info-only",
  }),
);
assert.equal(infoOnly.actionChoice, "DISCOVER");
assert.equal(infoOnly.legacyOrigin, "CTA");
assert.equal(infoOnly.requestLabelKind, "REQUEST");

const bookingRequestOnly = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-booking-request-only",
    bookingEnabled: true,
    bookingMode: "REQUEST_ONLY",
    bookingPhone: "+375291112244",
    bookingNote: "Send request",
  }),
);
assert.equal(bookingRequestOnly.actionChoice, "REQUEST");
assert.equal(bookingRequestOnly.requestMode, "SIMPLE");
assert.equal(bookingRequestOnly.requestLabelKind, "REQUEST");
assert.equal(bookingRequestOnly.legacyOrigin, "BOOKING");

const bookingDates = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-booking-dates",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_DATES",
    bookingPhone: "+375291112245",
    timeSlots: {
      dates: [
        {
          id: "date-booking",
          isoDate: "2026-07-12",
          label: "2026-07-12",
          slots: [],
        },
      ],
    },
  }),
);
assert.equal(bookingDates.actionChoice, "REQUEST");
assert.equal(bookingDates.requestMode, "CALENDAR");
assert.equal(bookingDates.calendarMode, "DATE_ONLY");
assert.equal(bookingDates.legacyOrigin, "BOOKING");

const bookingSlots = mapEventLegacyCtaToStepValue(
  createLegacyInput({
    id: "event-booking-slots",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_SLOTS",
    bookingPhone: "+375291112246",
    timeSlots: {
      dates: [
        {
          id: "date-slots",
          isoDate: "2026-07-13",
          label: "2026-07-13",
          slots: [
            {
              id: "slot-booking",
              startTime: "14:00",
              endTime: "15:00",
              capacity: 4,
            },
          ],
        },
      ],
    },
  }),
);
assert.equal(bookingSlots.actionChoice, "REQUEST");
assert.equal(bookingSlots.requestMode, "CALENDAR");
assert.equal(bookingSlots.calendarMode, "DATE_AND_TIME");
assert.equal(bookingSlots.legacyOrigin, "BOOKING");

const reverseExternalLink = mapCtaStepValueToEventLegacy(externalLink, {
  id: "event-external-link",
});
assert.equal(reverseExternalLink.participationMode, "external-link");
assert.equal(reverseExternalLink.ticketLink, "https://tickets.example.com/event");

const reversePrebookPhone = mapCtaStepValueToEventLegacy(prebookPhone, {
  id: "event-prebook-phone",
});
assert.equal(reversePrebookPhone.participationMode, "prebook");
assert.equal(reversePrebookPhone.prebookMethod, "phone");
assert.equal(reversePrebookPhone.prebookPhone, "+375291112233");

const reversePrebookLink = mapCtaStepValueToEventLegacy(prebookLink, {
  id: "event-prebook-link",
});
assert.equal(reversePrebookLink.participationMode, "prebook");
assert.equal(reversePrebookLink.prebookMethod, "link");
assert.equal(reversePrebookLink.prebookUrl, "https://example.com/prebook");

const reverseTimeSlots = mapCtaStepValueToEventLegacy(timeSlots, {
  id: "event-time-slots",
});
assert.equal(reverseTimeSlots.participationMode, "time-slots");
assert.equal(reverseTimeSlots.timeSlots.dates[0]?.isoDate, "2026-07-11");
assert.equal(reverseTimeSlots.timeSlots.dates[0]?.slots[0]?.startTime, "10:00");

const reverseSimpleBooking = mapCtaStepValueToEventLegacy(simpleBooking, {
  id: "event-simple-booking",
});
assert.equal(reverseSimpleBooking.participationMode, "simple-booking");

const reverseRequest = mapCtaStepValueToEventLegacy(request, {
  id: "event-request",
});
assert.equal(reverseRequest.participationMode, "request");

const reverseWalkIn = mapCtaStepValueToEventLegacy(walkIn, {
  id: "event-walk-in",
});
assert.equal(reverseWalkIn.participationMode, "walk-in");

const reverseInfoOnly = mapCtaStepValueToEventLegacy(infoOnly, {
  id: "event-info-only",
});
assert.equal(reverseInfoOnly.participationMode, "info-only");

const reverseBookingRequestOnly = mapCtaStepValueToEventLegacy(bookingRequestOnly, {
  id: "event-booking-request-only",
});
assert.equal(reverseBookingRequestOnly.bookingEnabled, true);
assert.equal(reverseBookingRequestOnly.bookingMode, "REQUEST_ONLY");
assert.equal(reverseBookingRequestOnly.bookingPhone, "+375291112244");

const reverseBookingDates = mapCtaStepValueToEventLegacy(bookingDates, {
  id: "event-booking-dates",
});
assert.equal(reverseBookingDates.bookingEnabled, true);
assert.equal(reverseBookingDates.bookingMode, "USE_PUBLICATION_DATES");

const reverseBookingSlots = mapCtaStepValueToEventLegacy(bookingSlots, {
  id: "event-booking-slots",
});
assert.equal(reverseBookingSlots.bookingEnabled, true);
assert.equal(reverseBookingSlots.bookingMode, "USE_PUBLICATION_SLOTS");

const formExternal = getDefaultFormData();
formExternal.participationMode = "external-link";
formExternal.ticketLink = "https://tickets.example.com/current";
const mappedFormExternal = mapEventFormDataToCtaStepValue(formExternal, {
  id: "event-form-external",
});
assert.equal(mappedFormExternal.actionChoice, "EXTERNAL");
assert.equal(mappedFormExternal.externalKind, "TICKETS");

const formPrebook = getDefaultFormData();
formPrebook.participationMode = "prebook";
formPrebook.prebookMethod = "phone";
formPrebook.prebookPhone = "+375291119999";
const mappedFormPrebook = mapEventFormDataToCtaStepValue(formPrebook, {
  id: "event-form-prebook",
});
assert.equal(mappedFormPrebook.actionChoice, "REQUEST");
assert.equal(mappedFormPrebook.requestMode, "SIMPLE");
assert.equal(mappedFormPrebook.fallback.phone, "+375291119999");

const formSlots = getDefaultFormData();
formSlots.publicationAccess = {
  method: "timeslots",
  timeSlots: [
    {
      id: "slot-form",
      date: "2026-07-14",
      startTime: "16:00",
      endTime: "17:00",
      capacity: 6,
    },
  ],
};
const mappedFormSlots = mapEventFormDataToCtaStepValue(formSlots, {
  id: "event-form-slots",
});
assert.equal(mappedFormSlots.actionChoice, "REQUEST");
assert.equal(mappedFormSlots.requestMode, "CALENDAR");
assert.equal(mappedFormSlots.calendarMode, "DATE_AND_TIME");
assert.equal(mappedFormSlots.calendarDays[0]?.date, "2026-07-14");

const formSharedExternal = getDefaultFormData();
formSharedExternal.publicationAccess = {
  method: "external",
  externalUrl: "https://example.com/landing",
  ticketUrl: "https://fallback.example.com",
  phone: "+375291110000",
};
const mappedSharedExternal = mapEventFormDataToCtaStepValue(formSharedExternal, {
  id: "event-form-shared-external",
});
assert.equal(mappedSharedExternal.actionChoice, "EXTERNAL");
assert.equal(mappedSharedExternal.externalKind, "SITE");
assert.equal(mappedSharedExternal.externalUrl, "https://example.com/landing");
assert.equal(mappedSharedExternal.fallback.website, "https://fallback.example.com");
assert.equal(mappedSharedExternal.fallback.phone, "+375291110000");

const formSharedContact = getDefaultFormData();
formSharedContact.publicationAccess = {
  method: "contact",
  phone: "+375291110001",
  externalUrl: "https://business.example.com",
  instructions: "Reply soon",
};
const mappedSharedContact = mapEventFormDataToCtaStepValue(formSharedContact, {
  id: "event-form-shared-contact",
});
assert.equal(mappedSharedContact.actionChoice, "REQUEST");
assert.equal(mappedSharedContact.requestMode, "SIMPLE");
assert.equal(mappedSharedContact.requestLabelKind, "REQUEST");
assert.equal(mappedSharedContact.fallback.phone, "+375291110001");
assert.equal(mappedSharedContact.fallback.website, "https://business.example.com");
assert.equal(mappedSharedContact.instructions, "Reply soon");

const formPatchExternal = mapCtaStepValueToEventFormPatch(mappedSharedExternal, {
  id: "event-form-shared-external",
});
assert.equal(formPatchExternal.publicationAccess?.method, "external");
assert.equal(formPatchExternal.publicationAccess?.externalUrl, "https://example.com/landing");
assert.equal(formPatchExternal.publicationAccess?.ticketUrl, "https://fallback.example.com");
assert.equal(formPatchExternal.participationMode, "external-link");

const formPatchContact = mapCtaStepValueToEventFormPatch(mappedSharedContact, {
  id: "event-form-shared-contact",
});
assert.equal(formPatchContact.publicationAccess?.method, "contact");
assert.equal(formPatchContact.publicationAccess?.externalUrl, "https://business.example.com");
assert.equal(formPatchContact.publicationAccess?.phone, "+375291110001");
assert.equal(formPatchContact.participationMode, "walk-in");
assert.equal(formPatchContact.ctaStepDraft?.requestLabelKind, "REQUEST");

const roundtripContactForm = {
  ...getDefaultFormData(),
  ...formPatchContact,
};
const roundtripContactPayload = buildEventPayload(roundtripContactForm);
const roundtripContactLoaded = mapEventToFormData({
  id: "event-roundtrip-contact",
  title: "Roundtrip contact",
  description: "",
  ageTags: [],
  scheduleJson: roundtripContactPayload.scheduleJson as Record<string, unknown>,
  coverImageId: null,
  placeId: null,
  eventCategoryId: null,
  priceFrom: null,
  priceTo: null,
  priceText: null,
  format: DEFAULT_ACTIVITY_FORMAT,
} as unknown as ActivityWithRelations);
const roundtripContactStep = mapEventFormDataToCtaStepValue(roundtripContactLoaded, {
  id: "event-roundtrip-contact",
});
assert.equal(roundtripContactStep.actionChoice, "REQUEST");
assert.equal(roundtripContactStep.requestMode, "SIMPLE");
assert.equal(roundtripContactStep.requestLabelKind, "REQUEST");
assert.equal(roundtripContactStep.fallback.phone, "+375291110001");
assert.equal(roundtripContactStep.fallback.website, "https://business.example.com");

const roundtripExternalForm = {
  ...getDefaultFormData(),
  ...formPatchExternal,
};
const roundtripExternalPayload = buildEventPayload(roundtripExternalForm);
const roundtripExternalLoaded = mapEventToFormData({
  id: "event-roundtrip-external",
  title: "Roundtrip external",
  description: "",
  ageTags: [],
  scheduleJson: roundtripExternalPayload.scheduleJson as Record<string, unknown>,
  coverImageId: null,
  placeId: null,
  eventCategoryId: null,
  priceFrom: null,
  priceTo: null,
  priceText: null,
  format: DEFAULT_ACTIVITY_FORMAT,
} as unknown as ActivityWithRelations);
const roundtripExternalStep = mapEventFormDataToCtaStepValue(roundtripExternalLoaded, {
  id: "event-roundtrip-external",
});
assert.equal(roundtripExternalStep.actionChoice, "EXTERNAL");
assert.equal(roundtripExternalStep.externalKind, "SITE");
assert.equal(roundtripExternalStep.externalUrl, "https://example.com/landing");
assert.equal(roundtripExternalStep.fallback.website, "https://fallback.example.com");

assertCanonicalParity(
  createLegacyInput({
    id: "parity-external-link",
    participationMode: "external-link",
    ticketLink: "https://tickets.example.com/event",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-prebook-phone",
    participationMode: "prebook",
    prebookMethod: "phone",
    prebookPhone: "+375291112233",
    bookingNote: "Call to confirm",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-prebook-link",
    participationMode: "prebook",
    prebookMethod: "link",
    prebookUrl: "https://example.com/prebook",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-time-slots",
    participationMode: "time-slots",
    timeSlots: {
      dates: [
        {
          id: "date-1",
          isoDate: "2026-07-11",
          label: "2026-07-11",
          slots: [
            {
              id: "slot-1",
              startTime: "10:00",
              endTime: "11:00",
              capacity: 8,
            },
          ],
        },
      ],
    },
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-simple-booking",
    participationMode: "simple-booking",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-request",
    participationMode: "request",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-walk-in",
    participationMode: "walk-in",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-info-only",
    participationMode: "info-only",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-booking-request-only",
    bookingEnabled: true,
    bookingMode: "REQUEST_ONLY",
    bookingPhone: "+375291112244",
    bookingNote: "Send request",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-booking-dates",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_DATES",
    bookingPhone: "+375291112245",
    timeSlots: {
      dates: [
        {
          id: "date-booking",
          isoDate: "2026-07-12",
          label: "2026-07-12",
          slots: [],
        },
      ],
    },
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-booking-slots",
    bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_SLOTS",
    bookingPhone: "+375291112246",
    timeSlots: {
      dates: [
        {
          id: "date-slots",
          isoDate: "2026-07-13",
          label: "2026-07-13",
          slots: [
            {
              id: "slot-booking",
              startTime: "14:00",
              endTime: "15:00",
              capacity: 4,
            },
          ],
        },
      ],
    },
  }),
);

console.log("event cta step mapper tests: OK");
