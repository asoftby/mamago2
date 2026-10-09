import assert from "node:assert/strict";

import { resolveEventActionPhones, resolvePurchaseUrl, type ActivityForEventPageInput } from "./buildEventPageDataFromPrisma";
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

console.log("buildEventPageDataFromPrisma abws-ticketLink tests: OK");
