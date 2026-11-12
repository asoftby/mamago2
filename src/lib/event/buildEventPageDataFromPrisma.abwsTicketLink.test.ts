import assert from "node:assert/strict";

import { resolveEventActionPhones, resolvePurchaseUrl, resolveSimpleBooking, type ActivityForEventPageInput } from "./buildEventPageDataFromPrisma";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { ABWS_DISTRIBUTOR_COMPANY_ID } from "@/lib/abws/saleframeUrl";

/**
 * resolvePurchaseUrl() feeds data.cta.purchaseUrl, which the already-shipped
 * "Купить билет" button (EventDecisionPanel / sticky bar) renders directly —
 * a raw ABWS pid link here means a real, unattributed sale the moment any
 * ABWS card gets published with a ticketLink. Found by automated review on
 * PR #296, verified and fixed here — see decorateStoredTicketLink.
 */

// ── ABWS pid ticketLink gets decorated (distributor_company_id + lang) ──────
{
  const url = resolvePurchaseUrl({
    scheduleJson: {
      participationMode: "external-link",
      ticketLink: "https://saleframe.24afisha.by/?pid=332622",
    },
  });
  assert.ok(url);
  const parsed = new URL(url!);
  assert.equal(parsed.searchParams.get("distributor_company_id"), String(ABWS_DISTRIBUTOR_COMPANY_ID));
  assert.equal(parsed.searchParams.get("lang"), "ru");
}

// ── a business's own manually-entered ticket URL is untouched ───────────────
{
  const url = resolvePurchaseUrl({
    scheduleJson: {
      participationMode: "external-link",
      ticketLink: "https://ticketpro.by/event/12345",
    },
  });
  assert.equal(url, "https://ticketpro.by/event/12345");
}

// ── prebook mode is unaffected by any of this ────────────────────────────────
{
  const url = resolvePurchaseUrl({
    scheduleJson: {
      participationMode: "prebook",
      prebookMethod: "link",
      prebookUrl: "https://example.com/book",
    },
  });
  assert.equal(url, "https://example.com/book");
}

// Phone-only prebooking must not lose its actionable telephone CTA when
// the optional Contacts wizard step is empty.
{
  const phones = resolveEventActionPhones({
    scheduleJson: {
      participationMode: "prebook",
      prebookMethod: "phone",
      prebookPhone: "+375 (29) 123-45-67",
    },
    place: null,
  } as ActivityForEventPageInput);
  assert.equal(phones.length, 1);
  assert.equal(phones[0]?.href, "tel:+375291234567");
  assert.equal(phones[0]?.label, "Предварительная запись");
}

// Explicit prebook number takes priority over inherited contact numbers,
// without duplicating the same telephone.
{
  const phones = resolveEventActionPhones({
    scheduleJson: {
      participationMode: "prebook",
      prebookMethod: "phone",
      prebookPhone: "+375291234567",
    },
    phone: "+375291234567",
    phone2: "+375291111111",
    place: null,
  } as ActivityForEventPageInput);
  assert.deepEqual(phones.map((phone) => phone.href), [
    "tel:+375291234567",
    "tel:+375291111111",
  ]);
}

// Information-only publications must never turn the prebook field into an action.
{
  const phones = resolveEventActionPhones({
    scheduleJson: {
      participationMode: "none",
      prebookPhone: "+375291234567",
    },
    place: null,
  } as ActivityForEventPageInput);
  assert.deepEqual(phones, []);
}

// Legacy BOOKING-origin calendar saved as walk-in: the public signup stays actionable.
{
  const date = addDaysLocal(getLocalDateKey(), 7);
  const startsAt = localWallClockToUtc(date, "14:00");
  const legacy = {
    id: "event-legacy-calendar",
    bookingEnabled: true,
    businessId: "business-1",
    bookingMode: "USE_PUBLICATION_SLOTS",
    scheduleJson: {
      participationMode: "walk-in",
      ctaStepDraft: { legacyOrigin: "BOOKING", actionChoice: "REQUEST", requestMode: "CALENDAR" },
      timeSlots: {
        dates: [{ isoDate: date, slots: [{ startTime: "14:00", endTime: "15:00", capacity: 5 }] }],
      },
    },
    sessions: [{ id: "session-bookable", startsAt }],
  } as unknown as ActivityForEventPageInput;
  const booking = resolveSimpleBooking(legacy.id, legacy);
  assert.equal(booking?.slots?.length, 1);
  assert.equal(booking?.slots?.[0]?.id, "session-bookable");
  assert.equal(booking?.slots?.[0]?.endTime, "15:00");

  assert.equal(resolveSimpleBooking(legacy.id, {
    ...legacy,
    scheduleJson: { ...(legacy.scheduleJson as Record<string, unknown>), participationMode: null },
  })?.slots?.length, 1);
  assert.equal(resolveSimpleBooking(legacy.id, { ...legacy, bookingEnabled: false }), undefined);
  assert.equal(resolveSimpleBooking(legacy.id, { ...legacy, businessId: null }), undefined);
  assert.equal(resolveSimpleBooking(legacy.id, {
    ...legacy,
    sessions: [{ id: "past", startsAt: new Date(0) }],
  }), undefined);
  assert.equal(resolveSimpleBooking(legacy.id, {
    ...legacy,
    scheduleJson: {
      ...(legacy.scheduleJson as Record<string, unknown>),
      ctaStepDraft: { legacyOrigin: "BOOKING", actionChoice: "DISCOVER", requestMode: "CALENDAR" },
    },
  }), undefined);
}
{
  const request = {
    id: "event-request-only",
    bookingEnabled: true,
    businessId: "business-1",
    bookingMode: "REQUEST_ONLY",
    scheduleJson: {},
    sessions: [],
  } as unknown as ActivityForEventPageInput;
  assert.equal(resolveSimpleBooking(request.id, request)?.label, "Оставить заявку");
}

console.log("buildEventPageDataFromPrisma abws-ticketLink tests: OK");
