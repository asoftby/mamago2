import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AgeRestrictionSchema, AvailabilityEvidenceSchema, BusinessPartyRequestTargetSchema,
  BynAmountSchema, ConstraintAssessmentSchema, OfferForConstructorSchema, OfferPriceEvidenceSchema,
  PackageCompositionSchema, PartyProgramItemSchema, PartySelectionContextSchema,
  PositionPriceSchema, PreliminaryEstimateSchema, ResourceWindowSchema, ServiceIntervalSchema,
  type OfferForConstructor, type PreliminaryEstimate,
} from "./constructorContract";

const interval = { startAt: "2026-12-01T12:00:00Z", endAt: "2026-12-01T13:00:00Z" };
const source = { entity: "Offer" as const, id: "offer-1", revision: "revision-1" };
const unknown = { state: "UNKNOWN" as const, reason: "NOT_PROVIDED" as const };
const offer = {
  contractVersion: 1, source, offerId: "offer-1", businessId: "business-1", productType: "PARTY_SERVICE",
  category: "SHOW", location: { mode: unknown, meaning: "EVENT_LOCATION" }, occasions: unknown,
  age: { agePolicy: "UNKNOWN", ageMinMonths: null, ageMaxMonths: null },
  participants: { children: { min: null, max: null }, totalCapacity: unknown },
  interests: unknown, geography: [{ kind: "UNKNOWN", reason: "NOT_PROVIDED" }],
  durationMinutes: unknown, price: { state: "UNRESOLVED", reason: "POLICY_PENDING", sources: [source] },
  composition: { state: "NOT_A_PACKAGE" }, availability: { state: "UNKNOWN", reason: "NO_SCHEDULE" },
} satisfies OfferForConstructor;

test("legacy missing optional data survives without invented restrictions, prices or availability", () => {
  assert.deepEqual(OfferForConstructorSchema.parse(offer), offer);
  const knownEmpty = { ...offer, interests: { state: "KNOWN", value: [] } };
  assert.equal(OfferForConstructorSchema.safeParse(knownEmpty).success, true);
  assert.notDeepEqual(knownEmpty.interests, offer.interests);
});

test("canonical interests, category and source identity cannot drift", () => {
  assert.equal(OfferForConstructorSchema.safeParse({ ...offer,
    interests: { state: "KNOWN", value: ["invented-interest"] } }).success, false);
  assert.equal(OfferForConstructorSchema.safeParse({ ...offer, category: null }).success, false);
  assert.equal(OfferForConstructorSchema.safeParse({ ...offer, source: { ...source, id: "other" } }).success, false);
  assert.equal(OfferForConstructorSchema.safeParse({ ...offer,
    participants: { ...offer.participants, children: { min: 10, max: 5 } } }).success, false);
});

test("adult-only, unknown and unrestricted stay distinct through the existing age invariant", () => {
  for (const agePolicy of ["ADULT_ONLY", "UNRESTRICTED", "UNKNOWN"])
    assert.equal(AgeRestrictionSchema.parse({ agePolicy, ageMinMonths: null, ageMaxMonths: null }).agePolicy, agePolicy);
  assert.equal(AgeRestrictionSchema.safeParse({ agePolicy: "ADULT_ONLY", ageMinMonths: 0, ageMaxMonths: null }).success, false);
  assert.equal(AgeRestrictionSchema.safeParse({ agePolicy: "SPECIFIC", ageMinMonths: null, ageMaxMonths: null }).success, false);
  assert.equal(AgeRestrictionSchema.safeParse({ agePolicy: "SPECIFIC", ageMinMonths: 72, ageMaxMonths: 36 }).success, false);
});

test("money, unknown prices and conflicting sources cannot silently become zero/exact", () => {
  for (const value of [0, "0", "-1.00", "1.001", "NaN", "01.00"])
    assert.equal(BynAmountSchema.safeParse(value).success, false);
  assert.equal(BynAmountSchema.parse("0.00"), "0.00");
  assert.equal(PositionPriceSchema.safeParse({ kind: "ON_REQUEST", amountByn: "0.00" }).success, false);
  assert.equal(PositionPriceSchema.safeParse({ kind: "FROM", amountByn: "100.00" }).success, false);
  const unresolved = { state: "UNRESOLVED", reason: "SOURCE_CONFLICT", sources: [source] };
  assert.deepEqual(OfferPriceEvidenceSchema.parse(unresolved), unresolved);
  assert.equal(OfferPriceEvidenceSchema.safeParse({ ...unresolved, price: { kind: "EXACT", amountByn: "0.00" } }).success, false);
});

test("legacy category coverage does not invent removable, priced package components", () => {
  const legacy = { state: "LEGACY_CATEGORY_COVERAGE", categories: ["CAKE"], source };
  assert.deepEqual(PackageCompositionSchema.parse(legacy), legacy);
  assert.equal(OfferForConstructorSchema.safeParse({ ...offer, productType: "PARTY_PACKAGE", composition: legacy }).success, true);
  assert.equal(OfferForConstructorSchema.safeParse({ ...offer, composition: legacy }).success, false);
  const component = { componentId: "component-1", source: { entity: "PackageComponent", id: "component-1", revision: "r1" },
    category: "CAKE", refOfferId: null, title: "Cake", legacyIsOptional: true, removable: unknown,
    removalPriceRule: { state: "POLICY_PENDING" } };
  assert.equal(PackageCompositionSchema.safeParse({ state: "COMPONENTS", components: [component] }).success, true);
  assert.equal(PackageCompositionSchema.safeParse({ state: "COMPONENTS", components: [component, component] }).success, false);
  assert.equal(PackageCompositionSchema.safeParse({ state: "COMPONENTS", components: [{ ...component,
    source: { ...component.source, id: "different-component" } }] }).success, false);
});

test("UTC intervals are nonempty and occupied windows retain exact prep/cleanup", () => {
  for (const bad of [{ ...interval, endAt: interval.startAt }, { startAt: "2026-12-01T15:00:00", endAt: interval.endAt }])
    assert.equal(ServiceIntervalSchema.safeParse(bad).success, false);
  const window = { bookingUnitId: "unit-1", service: interval,
    occupied: { startAt: "2026-12-01T11:40:00Z", endAt: "2026-12-01T13:15:00Z" }, prepMinutes: 20, cleanupMinutes: 15 };
  assert.equal(ResourceWindowSchema.safeParse(window).success, true);
  assert.equal(ResourceWindowSchema.safeParse({ ...window, occupied: interval }).success, false);
  assert.equal(AvailabilityEvidenceSchema.safeParse({ state: "AVAILABLE", checkedAt: interval.startAt,
    requested: interval, windows: [] }).success, false);
  assert.equal(AvailabilityEvidenceSchema.safeParse({ state: "AVAILABLE", checkedAt: interval.startAt,
    requested: { ...interval, endAt: "2026-12-01T14:00:00Z" }, windows: [window] }).success, false);
});

test("partial and unknown availability never parse as confirmed or full availability", () => {
  const partial = { state: "PARTIAL", checkedAt: interval.startAt, requested: interval, alternatives: [interval] };
  assert.equal(AvailabilityEvidenceSchema.parse(partial).state, "PARTIAL");
  assert.equal(AvailabilityEvidenceSchema.safeParse({ state: "UNKNOWN", reason: "NO_SCHEDULE", confirmed: true }).success, false);
});

test("budget/rating remain soft and business eligibility cannot be softened", () => {
  const assessment = { dimension: "BUDGET", strength: "SOFT", outcome: "UNKNOWN", reasonCode: "NO_BUDGET" };
  assert.equal(ConstraintAssessmentSchema.safeParse(assessment).success, true);
  assert.equal(ConstraintAssessmentSchema.safeParse({ ...assessment, strength: "HARD" }).success, false);
  assert.equal(ConstraintAssessmentSchema.safeParse({ ...assessment, dimension: "BUSINESS_ELIGIBILITY" }).success, false);
});

test("adult selection allows zero children; editor records origin without mutating choices", () => {
  const context = { contractVersion: 1, partyOrderId: "party-1", partyVersion: 2, entry: "PART", venueMode: "HOME",
    subjects: [{ kind: "adult", refId: null, source: "manual" }],
    ageMonthsOnEventDate: unknown, interests: unknown, destination: unknown, budget: unknown,
    dateRange: { from: "2026-12-01", to: "2026-12-02" }, interval: unknown, guests: { children: 0, adults: 10 } };
  assert.equal(PartySelectionContextSchema.safeParse(context).success, true);
  assert.equal(PartySelectionContextSchema.safeParse({ ...context, budget: {
    state: "KNOWN", value: { minimumByn: "600.00", maximumByn: "300.00" },
  } }).success, false);
  const specificContext = { ...context, ageMonthsOnEventDate: { state: "KNOWN", value: 67 },
    budget: { state: "KNOWN", value: { minimumByn: null, maximumByn: "600.00" } },
    destination: { state: "KNOWN", value: { territoryId: "territory-1", placeId: null } } };
  assert.equal(PartySelectionContextSchema.safeParse(specificContext).success, true);
  assert.equal(PartySelectionContextSchema.safeParse({ ...context, dateRange: { from: "2026-12-02", to: "2026-12-01" } }).success, false);
  const item = { itemId: "item-1", role: "ANCHOR", offerId: "offer-1", source: "USER_REPLACED",
    pinned: true, lifecycle: "ACTIVE", interval: unknown, dependsOnItemIds: [], assessments: [] };
  assert.deepEqual(PartyProgramItemSchema.parse(item), item);
});

test("estimate identifies unknowns and included lines without declaring a final amount", () => {
  const estimate = { contractVersion: 1, partyOrderId: "party-1", partyVersion: 2, calculatedAt: interval.startAt,
    currency: "BYN", lines: [
      { itemId: "anchor", price: { kind: "FROM", minimumByn: "100.00" }, sources: [source] },
      { itemId: "cake", price: { kind: "ON_REQUEST" }, sources: [] },
      { itemId: "included", price: { kind: "INCLUDED", parentItemId: "anchor", packageComponentId: "component-1" }, sources: [] },
    ], knownMinimumByn: "100.00", final: false, unpricedItemIds: ["cake"], unconfirmedItemIds: ["anchor", "cake"] } satisfies PreliminaryEstimate;
  assert.deepEqual(PreliminaryEstimateSchema.parse(estimate), estimate);
  for (const changes of [{ final: true }, { unpricedItemIds: [] }, { unconfirmedItemIds: ["other"] },
    { lines: [...estimate.lines, estimate.lines[0]] }])
    assert.equal(PreliminaryEstimateSchema.safeParse({ ...estimate, ...changes }).success, false);
});

test("a conflicted price remains unresolved in the estimate, distinct from a request quote", () => {
  const estimate = { contractVersion: 1, partyOrderId: "party-1", partyVersion: 2, calculatedAt: interval.startAt,
    currency: "BYN", lines: [{ itemId: "conflict", price: { kind: "UNRESOLVED", reason: "SOURCE_CONFLICT" }, sources: [source] }],
    knownMinimumByn: "0.00", final: false, unpricedItemIds: ["conflict"], unconfirmedItemIds: ["conflict"] } satisfies PreliminaryEstimate;
  assert.deepEqual(PreliminaryEstimateSchema.parse(estimate), estimate);
  assert.equal(PreliminaryEstimateSchema.safeParse({ ...estimate, unpricedItemIds: [] }).success, false);
});

test("included estimate lines cannot form a cycle of any length", () => {
  for (const size of [1, 2, 3]) {
    const lines = Array.from({ length: size }, (_, i) => ({ itemId: `item-${i}`,
      price: { kind: "INCLUDED", parentItemId: `item-${(i + 1) % size}`, packageComponentId: `component-${i}` }, sources: [] }));
    assert.equal(PreliminaryEstimateSchema.safeParse({ contractVersion: 1, partyOrderId: "party-1", partyVersion: 2,
      calculatedAt: interval.startAt, currency: "BYN", lines, knownMinimumByn: "0.00", final: false,
      unpricedItemIds: [], unconfirmedItemIds: [] }).success, false);
  }
});

test("Telegram target selects a single request without accepting identity, credentials or commands", () => {
  const target = { contractVersion: 1, destination: "PARTY_REQUEST", requestId: "request-1" };
  assert.deepEqual(BusinessPartyRequestTargetSchema.parse(target), target);
  for (const extra of [{ businessId: "other" }, { contactPhone: "synthetic" }, { token: "token" },
    { action: "CONFIRM" }, { referenceUrl: "https://example.test/private" }])
    assert.equal(BusinessPartyRequestTargetSchema.safeParse({ ...target, ...extra }).success, false);
});
