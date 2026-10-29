import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickPartyProviders, type ProviderOffer } from "./partyProviderMatching";

const make = (i: number, overrides: Partial<ProviderOffer> = {}): ProviderOffer => ({
  id: "offer" + i, businessId: "business" + i, category: "CAKE",
  locationType: "OFF_SITE", ageMinMonths: 24, ageMaxMonths: 144,
  minChildren: 1, maxChildren: 30, priceByn: 120 + i,
  availability: "AVAILABLE", ...overrides,
});
const offers = Array.from({ length: 9 }, (_, i) => make(i + 1));
const base = {
  offers, category: "CAKE" as const, venueMode: "HOME" as const,
  childAgeYears: 7, childrenCount: 10, budgetByn: 200,
};
const first = pickPartyProviders(base);
assert.equal(first.length, 5, "never more than five provider businesses");
assert.equal(new Set(first.map(x => x.businessId)).size, first.length);
assert.deepEqual(first.map(x => x.offerId), ["offer1", "offer2", "offer3", "offer4", "offer5"]);
assert.deepEqual(pickPartyProviders({ ...base, preferredOfferId: "offer8" }).map(x => x.offerId),
  ["offer8", "offer1", "offer2", "offer3", "offer4"], "selected offer should be considered first");
assert.equal(pickPartyProviders({ ...base, limit: 100 }).length, 5, "limit is capped to five");
assert.equal(pickPartyProviders({ ...base, limit: 2 }).length, 2);
assert.equal(pickPartyProviders({ ...base, excludeBusinessIds: ["business1", "business2"] }).length, 5);
assert.ok(!pickPartyProviders({ ...base, excludeBusinessIds: ["business1"] })
  .some(x => x.businessId === "business1"));
assert.deepEqual(pickPartyProviders({ ...base, offers: [
  make(1, { availability: "UNAVAILABLE" }),
  make(2, { availability: "UNKNOWN" }),
] }).map(x => x.offerId), ["offer2"], "unknown availability may be requested, busy must be skipped");
assert.equal(pickPartyProviders({ ...base, offers: [make(1, { locationType: "ON_SITE" })] }).length, 0,
  "do not invite venue-only services to a home party");
assert.equal(pickPartyProviders({ ...base, offers: [make(1, { ageMinMonths: 96 })] }).length, 0);
assert.equal(pickPartyProviders({ ...base, offers: [make(1, { maxChildren: 5 })] }).length, 0);
assert.equal(pickPartyProviders({ ...base, offers: [make(1, { category: "DECOR" })] }).length, 0);
assert.deepEqual(pickPartyProviders({ ...base, offers: [
  make(1, { businessId: "same-business" }),
  make(2, { businessId: "same-business" }),
  make(3),
] }).map(x => x.offerId), ["offer1", "offer3"], "do not invite one business twice");
assert.equal(pickPartyProviders({ ...base, offers: [
  make(1, { priceByn: 900 }),
] }).length, 1, "budget must remain soft, not a hard rejection");
assert.deepEqual(pickPartyProviders({ ...base, offers: [
  make(1, { availability: "UNKNOWN", priceByn: 30 }),
  make(2, { availability: "AVAILABLE", priceByn: 60 }),
] }).map(x => x.offerId), ["offer2", "offer1"], "verified availability ranks above unknown");

const service = readFileSync("src/server/birthday/partyProviderMatching.service.ts", "utf8");
for (const token of [
  "getPublicBirthdayOfferWhere(city.id)",
  'operationalStatus: "ACTIVE", verificationStatus: "APPROVED"',
  'productType: "PARTY_SERVICE", category: input.category',
  'OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }]',
  "isWithinSchedule(booking, unit.rules, unit.exceptions)",
  "!unit.blocks.some(overlap) && !unit.allocations.some(overlap)",
  'availability = free ? "AVAILABLE" : "UNAVAILABLE"',
]) assert.ok(service.includes(token), "provider discovery missing guard: " + token);
assert.ok(!service.includes("bookingRequest.create") && !service.includes("partyOutbox.create"),
  "candidate discovery must be read-only; dispatch happens in a separate step");

// Regression: viable providers beyond the former 250-offer cutoff remain eligible.
const largePool = Array.from({ length: 300 }, (_, i) =>
  make(i + 1, { availability: i < 250 ? "UNAVAILABLE" : "AVAILABLE", priceByn: 100 }));
assert.deepEqual(pickPartyProviders({ ...base, offers: largePool }).map(x => x.offerId),
  ["offer251", "offer252", "offer253", "offer254", "offer255"]);
assert.match(service, /take: 200/);
assert.match(service, /cursor: \{ id: cursor \}, skip: 1/);
assert.match(service, /if \(offers\.length < 200\) break/);
assert.ok(!service.includes("take: 250"), "Matching must not truncate candidates to newest 250");

console.log("partyProviderMatching.test.ts: OK");
