import assert from "node:assert/strict";

import { resolveActivityParticipationCta } from "./resolveActivityParticipationCta";
import { ABWS_DISTRIBUTOR_COMPANY_ID } from "@/lib/abws/saleframeUrl";
import type { PlanItemWithActivity } from "@/server/services/plan.service";

/**
 * Second live consumer of scheduleJson.ticketLink (Купить билет in "Мой
 * план") — same raw-passthrough gap as resolvePurchaseUrl, found by
 * automated review on PR #296.
 */
type ActivityForCta = NonNullable<PlanItemWithActivity["activity"]>;

function baseActivity(scheduleJson: unknown): ActivityForCta {
  return {
    id: "activity-1",
    slug: "some-event",
    title: "Кукольный спектакль «Теремок»",
    type: "EVENT",
    coverImageUrl: null,
    ageLabel: null,
    eventCategory: null,
    priceFrom: null,
    priceText: null,
    currency: "BYN",
    status: "PUBLISHED",
    owner: null,
    place: null,
    venue: null,
    scheduleJson,
  };
}

{
  const cta = resolveActivityParticipationCta(
    baseActivity({
      participationMode: "external-link",
      ticketLink: "https://saleframe.24afisha.by/?pid=332622",
    }),
    "minsk",
  );
  assert.ok(cta);
  const url = new URL(cta!.href);
  assert.equal(url.searchParams.get("distributor_company_id"), String(ABWS_DISTRIBUTOR_COMPANY_ID));
  assert.equal(url.searchParams.get("lang"), "ru");
}

{
  const cta = resolveActivityParticipationCta(
    baseActivity({ participationMode: "external-link", ticketLink: "https://ticketpro.by/event/12345" }),
    "minsk",
  );
  assert.equal(cta?.href, "https://ticketpro.by/event/12345");
}

console.log("resolveActivityParticipationCta abws-ticketLink tests: OK");
