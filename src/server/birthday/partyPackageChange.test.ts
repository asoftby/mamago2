import { readFileSync } from "node:fs";
import { partyBusinessReplySchema } from "./partyBusiness.validation";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { packageChangeScope } from "./partyPackageChange";
import { readPackageChangeScope, supportsPackageChanges } from "@/lib/birthday/packageChangeScope";
import { partyOutboxActionUrl } from "./partyOutbox.logic";
const item = { id: "anchor", role: "ANCHOR", category: "VENUE", businessId: "business", offerId: "package",
  offerPriceSnapshot: new Prisma.Decimal("100.10"), draftPriceModeSnapshot: "EXACT", packageComponentSnapshot: null,
  packageComponentChange: null, offer: { title: "Package" } };
const component = { ...item, id: "component", role: "INCLUDED", offerId: null,
  packageComponentSnapshot: { id: "original", title: "Component", removalPolicy: "REMOVABLE_FIXED_CREDIT", removalCreditByn: "0.10" },
  packageComponentChange: { creditByn: "0.10", requiresQuote: false } };
const scope = packageChangeScope({ id: "order", version: 7, venueMode: "PACKAGE", items: [item, component] })!;
assert.equal(scope.requestedPrice.amountByn, "100.00");
assert.equal(scope.originalPrice.amountByn, "100.10");
assert.equal(scope.components[0].snapshot.id, "original");
assert.deepEqual(readPackageChangeScope(scope), scope);
assert.equal(readPackageChangeScope({ status: "FIXED", totalByn: "500" }), null);
assert.equal(partyOutboxActionUrl("PARTY_REQUEST_SENT", "request", "order"), "/business/bookings?tab=action&kind=party&request=request");
assert.equal(partyOutboxActionUrl("PARTY_QUOTE_SENT", "request", "order"), "/me/birthdays/order");
assert.equal(partyOutboxActionUrl("PARTY_QUOTE_ACCEPTED", "r&foreign", "order").includes("r%26foreign"), true);
console.log("PASS Decimal frozen brief, snapshot parser and scoped notification links");

const quote = { type: "MODIFIED", expectedStage: "SENT", expectedQuoteVersion: 0, priceByn: 0, includes: "Пакет бесплатно", changeReason: "Уточнили состав и цену" };
assert.equal(partyBusinessReplySchema.safeParse(quote).success, true);
assert.equal(partyBusinessReplySchema.safeParse({ ...quote, priceByn: 430.001 }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...quote, priceByn: -1 }).success, false);

const groupLock = readFileSync(new URL("./partyRequestLock.ts", import.meta.url), "utf8");
assert.match(groupLock, /pg_advisory_xact_lock/);
assert.match(groupLock, /ORDER BY r\."id" FOR UPDATE/);
for (const name of ["partyBusiness", "partyConfirm", "partyQuoteAcceptance"]) {
  assert.match(readFileSync(new URL("./" + name + ".service.ts", import.meta.url), "utf8"), /lockPartyRequestGroup\(tx, requestId\)/);
}

const review = readFileSync(new URL("../../features/birthday/builder/components/steps/StepReview.tsx", import.meta.url), "utf8");
assert.match(review, /unsupportedPackageChanges = hasPackageChanges && !supportsPackageChanges\(venueMode\)/);
for (const venueMode of ["VENUE", "PACKAGE"]) {
  assert.equal(supportsPackageChanges(venueMode), true);
  assert.deepEqual(packageChangeScope({ id: "order", version: 7, venueMode, items: [item, component] }), scope);
}
for (const venueMode of ["HOME", "OUTDOOR", "unknown"]) {
  assert.equal(supportsPackageChanges(venueMode), false);
  assert.throws(() => packageChangeScope({ id: "order", version: 7, venueMode, items: [item, component] }));
}
assert.match(review, /disabled=\{busy \|\| unsupportedPackageChanges/);
