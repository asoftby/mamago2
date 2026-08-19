import * as assert from "node:assert/strict";

import { PlaceCtaAdapter } from "@/lib/cta-platform";
import { getDefaultFormData } from "./defaults";
import {
  mapCtaStepValueToPlaceFormPatch,
  mapCtaStepValueToPlaceLegacy,
  mapPlaceFormDataToCtaStepValue,
  mapPlaceLegacyCtaToStepValue,
  type PlaceLegacyCtaFields,
} from "./ctaStepMapper";

function createLegacyInput(
  overrides: Partial<PlaceLegacyCtaFields>,
): PlaceLegacyCtaFields {
  return {
    id: overrides.id ?? "place-test",
    bookingEnabled: overrides.bookingEnabled ?? false,
    bookingPhone: overrides.bookingPhone ?? "",
    bookingNote: overrides.bookingNote ?? "",
    phone: overrides.phone ?? "",
    website: overrides.website ?? "",
  };
}

function assertCanonicalParity(input: PlaceLegacyCtaFields) {
  const mapped = mapPlaceLegacyCtaToStepValue(input);
  const roundtrip = mapCtaStepValueToPlaceLegacy(mapped, { id: input.id });

  const before = PlaceCtaAdapter.toCanonical(input);
  const after = PlaceCtaAdapter.toCanonical(roundtrip);

  assert.equal(after.actionKind, before.actionKind);
  assert.equal(after.executionKind, before.executionKind);
  assert.equal(after.primaryLabel, before.primaryLabel);
  assert.equal(after.instructions ?? "", before.instructions ?? "");
  assert.equal(after.externalTarget?.href ?? "", before.externalTarget?.href ?? "");
  assert.equal(after.contactFallback?.[0]?.href ?? "", before.contactFallback?.[0]?.href ?? "");
}

const phoneOnly = mapPlaceLegacyCtaToStepValue(
  createLegacyInput({
    id: "place-phone-only",
    phone: "+375291234567",
  }),
);
assert.equal(phoneOnly.actionChoice, "EXTERNAL");
assert.equal(phoneOnly.externalUrl, "");
assert.equal(phoneOnly.fallback.phone, "+375291234567");
assert.equal(phoneOnly.legacyOrigin, "CTA");

const websiteOnly = mapPlaceLegacyCtaToStepValue(
  createLegacyInput({
    id: "place-website-only",
    website: "https://example.com/place",
  }),
);
assert.equal(websiteOnly.actionChoice, "EXTERNAL");
assert.equal(websiteOnly.externalUrl, "https://example.com/place");
assert.equal(websiteOnly.fallback.phone, "");

const phoneAndWebsite = mapPlaceLegacyCtaToStepValue(
  createLegacyInput({
    id: "place-phone-and-website",
    phone: "+375291234568",
    website: "https://example.com/fallback",
  }),
);
assert.equal(phoneAndWebsite.actionChoice, "EXTERNAL");
assert.equal(phoneAndWebsite.externalUrl, "");
assert.equal(phoneAndWebsite.fallback.phone, "+375291234568");
assert.equal(phoneAndWebsite.fallback.website, "https://example.com/fallback");

const bookingPhone = mapPlaceLegacyCtaToStepValue(
  createLegacyInput({
    id: "place-booking-phone",
    bookingEnabled: true,
    bookingPhone: "+375291111111",
    bookingNote: "Leave a request",
  }),
);
assert.equal(bookingPhone.actionChoice, "EXTERNAL");
assert.equal(bookingPhone.fallback.phone, "+375291111111");
assert.equal(bookingPhone.instructions, "Leave a request");
assert.equal(bookingPhone.legacyOrigin, "BOOKING");

const bookingDiscover = mapPlaceLegacyCtaToStepValue(
  createLegacyInput({
    id: "place-booking-discover",
    bookingEnabled: true,
    bookingNote: "Ask admin",
  }),
);
assert.equal(bookingDiscover.actionChoice, "DISCOVER");
assert.equal(bookingDiscover.instructions, "Ask admin");
assert.equal(bookingDiscover.legacyOrigin, "BOOKING");

const noContacts = mapPlaceLegacyCtaToStepValue(
  createLegacyInput({
    id: "place-no-contacts",
  }),
);
assert.equal(noContacts.actionChoice, "DISCOVER");
assert.equal(noContacts.legacyOrigin, "CTA");

const reversePhoneOnly = mapCtaStepValueToPlaceLegacy(phoneOnly, {
  id: "place-phone-only",
});
assert.equal(reversePhoneOnly.phone, "+375291234567");
assert.equal(reversePhoneOnly.website, "");
assert.equal(reversePhoneOnly.bookingEnabled, false);

const reverseWebsiteOnly = mapCtaStepValueToPlaceLegacy(websiteOnly, {
  id: "place-website-only",
});
assert.equal(reverseWebsiteOnly.phone, "");
assert.equal(reverseWebsiteOnly.website, "https://example.com/place");

const reversePhoneAndWebsite = mapCtaStepValueToPlaceLegacy(phoneAndWebsite, {
  id: "place-phone-and-website",
});
assert.equal(reversePhoneAndWebsite.phone, "+375291234568");
assert.equal(reversePhoneAndWebsite.website, "https://example.com/fallback");

const reverseBookingPhone = mapCtaStepValueToPlaceLegacy(bookingPhone, {
  id: "place-booking-phone",
});
assert.equal(reverseBookingPhone.bookingEnabled, true);
assert.equal(reverseBookingPhone.bookingPhone, "+375291111111");
assert.equal(reverseBookingPhone.bookingNote, "Leave a request");

const reverseBookingDiscover = mapCtaStepValueToPlaceLegacy(bookingDiscover, {
  id: "place-booking-discover",
});
assert.equal(reverseBookingDiscover.bookingEnabled, true);
assert.equal(reverseBookingDiscover.bookingPhone, "");
assert.equal(reverseBookingDiscover.bookingNote, "Ask admin");

const reverseNoContacts = mapCtaStepValueToPlaceLegacy(noContacts, {
  id: "place-no-contacts",
});
assert.equal(reverseNoContacts.bookingEnabled, false);
assert.equal(reverseNoContacts.phone, "");
assert.equal(reverseNoContacts.website, "");

const formPhoneOnly = getDefaultFormData();
formPhoneOnly.phone = "+375291200001";
const mappedFormPhoneOnly = mapPlaceFormDataToCtaStepValue(formPhoneOnly, {
  id: "place-form-phone-only",
});
assert.equal(mappedFormPhoneOnly.actionChoice, "EXTERNAL");
assert.equal(mappedFormPhoneOnly.fallback.phone, "+375291200001");

const formBooking = getDefaultFormData();
formBooking.bookingEnabled = true;
formBooking.bookingPhone = "+375291200002";
formBooking.bookingNote = "Call first";
const mappedFormBooking = mapPlaceFormDataToCtaStepValue(formBooking, {
  id: "place-form-booking",
});
assert.equal(mappedFormBooking.actionChoice, "EXTERNAL");
assert.equal(mappedFormBooking.fallback.phone, "+375291200002");
assert.equal(mappedFormBooking.instructions, "Call first");

const formPatchPhoneAndWebsite = mapCtaStepValueToPlaceFormPatch(phoneAndWebsite, {
  id: "place-patch-phone-and-website",
});
assert.equal(formPatchPhoneAndWebsite.phone, "+375291234568");
assert.equal(formPatchPhoneAndWebsite.website, "https://example.com/fallback");
assert.equal(formPatchPhoneAndWebsite.bookingEnabled, false);

const formPatchBooking = mapCtaStepValueToPlaceFormPatch(bookingPhone, {
  id: "place-patch-booking",
});
assert.equal(formPatchBooking.bookingEnabled, true);
assert.equal(formPatchBooking.bookingPhone, "+375291111111");
assert.equal(formPatchBooking.bookingNote, "Leave a request");
assert.equal(formPatchBooking.phone, null);

assertCanonicalParity(
  createLegacyInput({
    id: "parity-phone-only",
    phone: "+375291234567",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-website-only",
    website: "https://example.com/place",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-phone-and-website",
    phone: "+375291234568",
    website: "https://example.com/fallback",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-booking-phone",
    bookingEnabled: true,
    bookingPhone: "+375291111111",
    bookingNote: "Leave a request",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-booking-discover",
    bookingEnabled: true,
    bookingNote: "Ask admin",
  }),
);
assertCanonicalParity(
  createLegacyInput({
    id: "parity-no-contacts",
  }),
);

console.log("place cta step mapper tests: OK");
