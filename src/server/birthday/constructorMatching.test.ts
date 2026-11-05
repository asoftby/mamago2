import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { OfferForConstructorSchema, AvailabilityEvidenceSchema } from "@/lib/birthday/constructorContract";
import { assessConstructorOffer, rankConstructorOffers, assessConstructorGeography } from "./constructorMatching";
import { constructorFixture, requirementsFixture } from "./constructorMatching.fixtures";
import { isEligibleForConstructor } from "./constructorEligibility";
import { assessPartyAvailability, type ConstructorUnit } from "./partyAvailabilityPreview.logic";
import { previewPartySlots } from "./partyPublicSlots";
import { matchesBirthdayRequirements } from "@/features/birthday/builder/lib/realCatalog";
import { partyRequirementsProblem } from "./partySelection";
const day = "2026-12-07"; // Monday
const now = new Date("2026-11-01T00:00:00Z");
const interval = { startAt: day+"T09:00:00.000Z", endAt: day+"T10:00:00.000Z" }; // 12–13 Minsk
const unit = (): ConstructorUnit => ({ id: "unit", updatedAt: now, status: "ACTIVE", timezone: "Europe/Minsk", capacity: 10,
  prepMinutes: 20, cleanupMinutes: 30, minDurationMinutes: 60, stepMinutes: 60,
  rules: [{ weekday: 1, startMinutes: 600, endMinutes: 1080 }], exceptions: [], blocks: [], allocations: [] });

test("adult without age is accepted by ADULT_ONLY and rejected by proven child-only limits", () => {
  const q = requirementsFixture();q.subjects = [{ kind: "adult", refId: null, source: "manual" }];
  const offer = constructorFixture(); offer.age.agePolicy = "ADULT_ONLY";
  assert.equal(assessConstructorOffer(offer,q).eligible,true);
  offer.age = { agePolicy: "SPECIFIC", ageMinMonths: 36, ageMaxMonths: 144 };
  assert.equal(assessConstructorOffer(offer,q).eligible,false);
  q.subjects = []; assert.equal(assessConstructorOffer(offer,q).eligible,true,"unknown subject is not a fabricated child");
  offer.age.agePolicy = "UNKNOWN";offer.age.ageMinMonths=null;offer.age.ageMaxMonths=null;
  assert.equal(assessConstructorOffer(offer,q).assessments.find(a=>a.dimension==='AGE')?.outcome,'UNKNOWN');
});

test("hard mismatch vs soft ranking: interests first, optional omissions neutral, budget never excludes", () => {
  const q = requirementsFixture();q.interests = { state: "KNOWN", value: ["science"] };
  q.budget = { state: "KNOWN", value: { minimumByn: "500.00", maximumByn: "1000.00" } };
  const low = constructorFixture('low'), high = constructorFixture('high');
  low.price = { state: "RESOLVED", source: low.source, price: { kind: "EXACT", amountByn: "100.00" } };
  high.price = { state: "RESOLVED", source: high.source, price: { kind: "FROM", minimumByn: "700.00" } };
  const ranked = () => rankConstructorOffers([low,high].map(offer=>({offer,...assessConstructorOffer(offer,q)})));
  assert.deepEqual(ranked().map(c=>c.offer.offerId),['high','low']);
  low.interests = { state: "KNOWN", value: ["science"] };
  assert.deepEqual(ranked().map(c=>c.offer.offerId),['low','high']);
  low.price = { state: "RESOLVED", source: low.source, price: { kind: "EXACT", amountByn: "1100.00" } };
  assert.equal(assessConstructorOffer(low,q).budgetFit,'SOFT_OVERRUN');
  low.price = { state: 'RESOLVED', source: low.source, price: { kind: 'EXACT', amountByn: '1100.01' } };assert.equal(assessConstructorOffer(low,q).eligible,true);
  q.budget.value.maximumByn=null;assert.equal(assessConstructorOffer(high,q).budgetFit,'UNKNOWN');
});

test("performer role and category-specific hidden fields", () => {
  const offer=constructorFixture();const q=requirementsFixture();q.performerRole='HOST';
  offer.category='ANIMATOR';offer.performerRole={state:'KNOWN',value:'ANIMATOR'};
  assert.equal(assessConstructorOffer(offer,q).eligible,false);
  offer.performerRole={state:'KNOWN',value:'HOST'};assert.equal(assessConstructorOffer(offer,q).eligible,true);
  offer.performerRole={state:'UNKNOWN',reason:'LEGACY_INCOMPLETE'};assert.equal(assessConstructorOffer(offer,q).eligible,true);
  offer.category='SHOW';assert.equal(assessConstructorOffer(offer,q).eligible,false);
});

test("real geography: explicit zones match/mismatch; registration does not imply worldwide travel", () => {
  const offer=constructorFixture();const target={state:'KNOWN' as const,value:{territoryId:'destination',placeId:null}};
  offer.location.mode={state:'KNOWN',value:'OFF_SITE'};
  offer.geography=[{kind:'AT_PLACE',placeId:'registered-place',territoryId:'registered-city'},{kind:'UNKNOWN',reason:'NOT_PROVIDED'}];
  assert.equal(assessConstructorGeography(offer,target,'HOME'),'UNKNOWN');
  offer.geography=[{kind:'SERVICE_AREA',purpose:'TRAVEL',territoryIds:['destination']}];
  assert.equal(assessConstructorGeography(offer,target,'HOME'),'MATCH');
  offer.geography=[{kind:'SERVICE_AREA',purpose:'TRAVEL',territoryIds:['other']}];assert.equal(assessConstructorGeography(offer,target,'HOME'),'MISMATCH');
});

test("resource evidence: exact, partial, occupied, unknown; buffers and shared allocation", () => {
  const u=unit();let e=assessPartyAvailability([u],interval,5,now);
  assert.equal(e.state,'AVAILABLE');assert.ok(AvailabilityEvidenceSchema.safeParse(e).success);
  if(e.state==='AVAILABLE') {assert.equal(e.windows[0].occupied.startAt,day+'T08:40:00.000Z');assert.equal(e.windows[0].occupied.endAt,day+'T10:30:00.000Z');}
  u.allocations=[{blockStart:new Date(day+'T10:10:00Z'),blockEnd:new Date(day+'T11:00:00Z')}];
  e=assessPartyAvailability([u],interval,5,now);assert.equal(e.state,'PARTIAL');assert.ok(AvailabilityEvidenceSchema.safeParse(e).success);
  u.blocks=[{blockStart:new Date(day+'T00:00:00Z'),blockEnd:new Date(day+'T23:59:00Z')}];
  assert.equal(assessPartyAvailability([u],interval,5,now).state,'UNAVAILABLE');
  assert.equal(assessPartyAvailability([],interval,5,now).state,'UNKNOWN');
  assert.equal(assessPartyAvailability([unit()],null,5,now).state,'UNKNOWN');
  const empty=unit();empty.rules=[];assert.equal(assessPartyAvailability([empty],interval,5,now).state,'UNKNOWN');
});

test("step belongs to containing interval and seconds are never rounded into AVAILABLE", () => {
  const u=unit();u.rules=[{weekday:1,startMinutes:600,endMinutes:660},{weekday:1,startMinutes:690,endMinutes:870}];
  assert.equal(assessPartyAvailability([u],interval,5,now).state,'PARTIAL');
  assert.ok(!previewPartySlots({day,durationMinutes:60,guestCount:5,now,units:[u]}).some(s=>s.start==='12:00'));
  const seconds={startAt:day+'T09:00:30.000Z',endAt:day+'T10:00:30.000Z'};
  const evidence=assessPartyAvailability([unit()],seconds,5,now);
  assert.equal(evidence.state,'PARTIAL');assert.ok(AvailabilityEvidenceSchema.safeParse(evidence).success);
});

test("one admission predicate: no account, zero, negative, suspended or unverified never pass", () => {
  const b={id:'business',operationalStatus:'ACTIVE' as const,verificationStatus:'APPROVED' as const,billingAccount:{status:'ACTIVE' as const,depositBalance:new Prisma.Decimal(1)}};
  assert.equal(isEligibleForConstructor(b),true);
  assert.equal(isEligibleForConstructor({...b,billingAccount:null}),false);
  for(const balance of [0,-1])assert.equal(isEligibleForConstructor({...b,billingAccount:{...b.billingAccount,depositBalance:new Prisma.Decimal(balance)}}),false);
  assert.equal(isEligibleForConstructor({...b,verificationStatus:'DRAFT'}),false);
});

test("canonical A1 DTO remains valid and all compatibility paths respect ADULT_ONLY", () => {
  const offer=constructorFixture();offer.age.agePolicy='ADULT_ONLY';assert.ok(OfferForConstructorSchema.safeParse(offer).success);
  assert.ok(partyRequirementsProblem({agePolicy:'ADULT_ONLY'}, {childrenCount:1,childAge:8}));
  assert.equal(partyRequirementsProblem({agePolicy:'ADULT_ONLY'}, {childrenCount:0,childAge:null}),null);
  assert.equal(matchesBirthdayRequirements({agePolicy:'ADULT_ONLY',ageMinMonths:null,ageMaxMonths:null,minChildren:null,maxChildren:null} as Parameters<typeof matchesBirthdayRequirements>[0],{ageMonths:96}),false);
});

test("pickup uses the real place and a delivery zone cannot become a travel zone", () => {
  const o=constructorFixture();const destination={state:"KNOWN" as const,value:{territoryId:"city",placeId:null}};
  o.category="CAKE";o.location={meaning:"FULFILMENT",mode:{state:"KNOWN",value:"ON_SITE"}};o.geography=[{kind:"AT_PLACE",territoryId:"city",placeId:"pickup"}];
  assert.equal(assessConstructorGeography(o,destination,"HOME"),"MATCH");
  o.category="SHOW";o.location={meaning:"EVENT_LOCATION",mode:{state:"KNOWN",value:"OFF_SITE"}};o.geography=[{kind:"SERVICE_AREA",purpose:"DELIVERY",territoryIds:["city"]}];
  assert.equal(assessConstructorGeography(o,destination,"HOME"),"UNKNOWN");
});

test("known chronological adulthood is not lost when the profile is stored as Child", () => {
  const o=constructorFixture();o.age.agePolicy="ADULT_ONLY";const q=requirementsFixture();q.subjects=[{kind:"child",refId:"grown-child",source:"profile"}];q.ageMonthsOnEventDate={state:"KNOWN",value:240};
  assert.equal(assessConstructorOffer(o,q).eligible,true);
});

test("FROM only disproves budget fit when its lower bound exceeds the ceiling", () => {
  const q = requirementsFixture();
  q.budget = { state: "KNOWN", value: { minimumByn: "500.00", maximumByn: "1000.00" } };
  const exact = constructorFixture("z-exact");
  const outside = constructorFixture("a-outside");
  const from = constructorFixture("m-from");
  const unpriced = constructorFixture("unpriced");
  exact.price = { state: "RESOLVED", source: exact.source, price: { kind: "EXACT", amountByn: "800.00" } };
  outside.price = { state: "RESOLVED", source: outside.source, price: { kind: "EXACT", amountByn: "1200.00" } };
  assert.equal(assessConstructorOffer(exact, q).budgetFit, "WITHIN");
  assert.equal(assessConstructorOffer(outside, q).budgetFit, "OUTSIDE_RANGE");
  assert.equal(assessConstructorOffer(unpriced, q).budgetFit, "UNKNOWN");
  for (const [minimumByn, expected] of [["400.00", "UNKNOWN"], ["700.00", "UNKNOWN"], ["1000.00", "UNKNOWN"], ["1100.00", "OUTSIDE_RANGE"]]) {
    from.price = { state: "RESOLVED", source: from.source, price: { kind: "FROM", minimumByn } };
    const assessment = assessConstructorOffer(from, q);
    assert.equal(assessment.budgetFit, expected);
    assert.equal(assessment.eligible, true);
  }
  assert.equal(assessConstructorOffer(from, { ...q, budget: { state: "KNOWN", value: { minimumByn: "500.00", maximumByn: null } } }).budgetFit, "UNKNOWN");
  from.price = { state: "RESOLVED", source: from.source, price: { kind: "FROM", minimumByn: "700.00" } };
  const ranked = rankConstructorOffers([outside, from, exact].map(offer => ({ offer, ...assessConstructorOffer(offer, q) })));
  assert.deepEqual(ranked.map(({ offer }) => offer.offerId), [exact.offerId, from.offerId, outside.offerId]);
});
