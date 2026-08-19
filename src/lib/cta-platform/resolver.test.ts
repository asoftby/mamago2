import * as assert from "node:assert/strict";

import { EventCtaAdapter } from "./adapters/eventCtaAdapter";
import { OfferCtaAdapter } from "./adapters/offerCtaAdapter";
import { PlaceCtaAdapter } from "./adapters/placeCtaAdapter";
import { resolveExecutionStrategy } from "./execution-strategy";
import { resolveCanonicalCta } from "./resolver";

const eventTicket = EventCtaAdapter.toCanonical({
  id: "event-ticket",
  participationMode: "external-link",
  ticketLink: "https://tickets.example/event",
});
assert.equal(eventTicket.actionKind, "EXTERNAL");
assert.equal(eventTicket.executionKind, "EXTERNAL_URL");
assert.equal(eventTicket.primaryLabel, "Купить билет");
assert.equal(eventTicket.externalTarget?.href, "https://tickets.example/event");
assert.equal("ticketLink" in eventTicket, false);

const eventSlots = EventCtaAdapter.toCanonical({
  id: "event-slots",
  participationMode: "time-slots",
  bookingPhone: "+375 (29) 000-00-00",
});
assert.equal(eventSlots.actionKind, "REQUEST");
assert.equal(eventSlots.requestConfig?.selectionMode, "SLOT");
assert.deepEqual(eventSlots.presentationHints, [
  "USES_CONTACT_FALLBACK",
  "REQUIRES_SLOT_SELECTION",
]);

const eventSimpleBooking = EventCtaAdapter.toCanonical({
  id: "event-simple-booking",
  participationMode: "simple-booking",
  bookingPhone: "+375291100001",
});
assert.equal(eventSimpleBooking.actionKind, "REQUEST");
assert.equal(eventSimpleBooking.primaryLabel, "Записаться");
assert.equal(eventSimpleBooking.requestConfig?.selectionMode, "NONE");

const eventRequest = EventCtaAdapter.toCanonical({
  id: "event-request",
  participationMode: "request",
  bookingPhone: "+375291100002",
});
assert.equal(eventRequest.actionKind, "DISCOVER");
assert.equal(eventRequest.primaryLabel, "Подробнее");
assert.equal(eventRequest.contactFallback?.[0]?.href, "tel:+375291100002");

const eventWalkIn = EventCtaAdapter.toCanonical({
  id: "event-walk-in",
  participationMode: "walk-in",
  bookingPhone: "+375291100003",
});
assert.equal(eventWalkIn.actionKind, "DISCOVER");
assert.equal(eventWalkIn.primaryLabel, "Подробнее");

const eventInfoOnly = EventCtaAdapter.toCanonical({
  id: "event-info-only",
  participationMode: "info-only",
});
assert.equal(eventInfoOnly.actionKind, "DISCOVER");
assert.equal(eventInfoOnly.primaryLabel, "Подробнее");

const eventPrebookFallbackPhone = EventCtaAdapter.toCanonical({
  id: "event-prebook-fallback-phone",
  participationMode: "prebook",
  prebookMethod: "phone",
  bookingPhone: "+375291100004",
});
assert.equal(eventPrebookFallbackPhone.actionKind, "EXTERNAL");
assert.equal(eventPrebookFallbackPhone.executionKind, "EXTERNAL_PHONE");
assert.equal(eventPrebookFallbackPhone.externalTarget?.href, "tel:+375291100004");

const eventLegacyBooking = EventCtaAdapter.toCanonical({
  id: "event-legacy-booking",
  bookingEnabled: true,
  bookingMode: "REQUEST_ONLY",
  bookingPhone: "+375291112233",
  bookingNote: "Coordinator will confirm",
});
assert.equal(eventLegacyBooking.actionKind, "REQUEST");
assert.equal(eventLegacyBooking.executionKind, "BOOKING_REQUEST");
assert.equal(eventLegacyBooking.instructions, "Coordinator will confirm");

const offerWebsite = OfferCtaAdapter.toCanonical({
  id: "offer-website",
  ctaType: "перейти_на_сайт",
  ctaLink: "https://example.com/program",
});
assert.equal(offerWebsite.actionKind, "EXTERNAL");
assert.equal(offerWebsite.primaryLabel, "Перейти на сайт");
assert.equal(offerWebsite.externalTarget?.channel, "URL");

const offerBooking = OfferCtaAdapter.toCanonical({
  id: "offer-booking",
  bookingEnabled: true,
  bookingMode: "USE_PUBLICATION_DATES",
  bookingPhone: "+375291112244",
});
assert.equal(offerBooking.actionKind, "REQUEST");
assert.equal(offerBooking.requestConfig?.selectionMode, "DATE");
assert.equal(offerBooking.primaryLabel, "Забронировать");

const offerRequestOnly = OfferCtaAdapter.toCanonical({
  id: "offer-request-only",
  bookingEnabled: true,
  bookingMode: "REQUEST_ONLY",
  bookingPhone: "+375291112245",
});
assert.equal(offerRequestOnly.actionKind, "REQUEST");
assert.equal(offerRequestOnly.requestConfig?.selectionMode, "NONE");
assert.equal(offerRequestOnly.primaryLabel, "Записаться");

const offerSlots = OfferCtaAdapter.toCanonical({
  id: "offer-slots",
  bookingEnabled: true,
  bookingMode: "USE_PUBLICATION_SLOTS",
  bookingPhone: "+375291112246",
});
assert.equal(offerSlots.actionKind, "REQUEST");
assert.equal(offerSlots.requestConfig?.selectionMode, "SLOT");
assert.equal(offerSlots.primaryLabel, "Забронировать");

// Legacy CAMP/SERVICE public CTA can still open a schedule-driven booking flow
// even when no explicit phone/link target is present in the view-model.
const offerCampNoTarget = OfferCtaAdapter.toCanonical({
  id: "offer-camp-no-target",
  ctaType: "записаться",
});
assert.equal(offerCampNoTarget.actionKind, "REQUEST");
assert.equal(offerCampNoTarget.primaryLabel, "Записаться");
assert.equal(offerCampNoTarget.requestConfig?.selectionMode, "NONE");

const offerServiceNoTarget = OfferCtaAdapter.toCanonical({
  id: "offer-service-no-target",
  ctaType: "записаться",
});
assert.equal(offerServiceNoTarget.actionKind, "REQUEST");
assert.equal(offerServiceNoTarget.primaryLabel, "Записаться");

const offerRequestNoTarget = OfferCtaAdapter.toCanonical({
  id: "offer-request-no-target",
  ctaType: "отправить_заявку",
});
assert.equal(offerRequestNoTarget.actionKind, "REQUEST");
assert.equal(offerRequestNoTarget.primaryLabel, "Оставить заявку");

const placePhone = PlaceCtaAdapter.toCanonical({
  id: "place-phone",
  phone: "+375291234567",
});
assert.equal(placePhone.actionKind, "EXTERNAL");
assert.equal(placePhone.executionKind, "EXTERNAL_PHONE");
assert.equal(placePhone.primaryLabel, "Позвонить");

const placeWebsite = PlaceCtaAdapter.toCanonical({
  id: "place-website",
  website: "https://example.com/place",
});
assert.equal(placeWebsite.actionKind, "EXTERNAL");
assert.equal(placeWebsite.executionKind, "EXTERNAL_URL");
assert.equal(placeWebsite.primaryLabel, "Перейти на сайт");

const placeBooking = resolveCanonicalCta({
  entityType: "PLACE",
  entity: {
    id: "place-booking",
    bookingEnabled: true,
    bookingPhone: "+375291111111",
    bookingNote: "Leave a request",
  },
});
assert.equal(placeBooking.actionKind, "EXTERNAL");
assert.equal(placeBooking.primaryLabel, "Позвонить");
assert.equal(resolveExecutionStrategy(placeBooking).kind, "EXTERNAL_RUNTIME");

const placeBookingNoPhone = PlaceCtaAdapter.toCanonical({
  id: "place-booking-no-phone",
  bookingEnabled: true,
  bookingNote: "Leave a request",
});
assert.equal(placeBookingNoPhone.actionKind, "DISCOVER");
assert.equal(placeBookingNoPhone.primaryLabel, "Подробнее");

const discoverStrategy = resolveExecutionStrategy(
  EventCtaAdapter.toCanonical({
    id: "event-discover",
    participationMode: "walk-in",
  }),
);
assert.equal(discoverStrategy.kind, "NO_RUNTIME");

console.log("cta platform resolver tests: OK");
