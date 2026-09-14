import assert from "node:assert/strict";

import { resolvePurchaseUrl } from "./buildEventPageDataFromPrisma";
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

console.log("buildEventPageDataFromPrisma abws-ticketLink tests: OK");
