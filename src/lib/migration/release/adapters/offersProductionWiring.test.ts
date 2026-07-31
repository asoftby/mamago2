import assert from "node:assert/strict";
import type { MigrationLineage, MigrationTargetType, Offer } from "@prisma/client";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { buildOfferDomainHashV2 } from "../../commit/offer/offerDomainHash";
import {
  createOffersDependencyResolver,
  createOffersTargetStateResolver,
  createOffersWriter,
  type OffersProductionWiringPrismaClient,
  type OffersWriterPrismaClient,
  type RawOfferSourceRepository,
} from "./offersProductionWiring";
import type { OffersMigrationCandidate } from "./offersAdapter";

const SOURCE_ID = "source-1";
const OFFER_KEY = "wordpress-db:hb-programs:18932";
const PLACE_KEY = "wordpress-db:places:100";

function fixtureCandidate(overrides: Partial<OffersMigrationCandidate> = {}): OffersMigrationCandidate {
  return {
    sourceRecordKey: OFFER_KEY,
    domainHashV2: "offer-domain-v2:fixture",
    dependencyPlan: { placeSourceRecordKey: PLACE_KEY, businessSourceKey: null, placeReadiness: "EXISTS_NOW", businessReadiness: null },
    ...overrides,
  };
}

const relation = (placeId: number) => ({ post_id: 18932, related_post_id: placeId, related_post_type: "places" as const, relation_key: "post-relation-hb-programs", relation_order: 0, relation_side: "parent" as const });

function fixtureRawCandidate(overrides: Partial<NormalizedOfferCandidate> = {}): NormalizedOfferCandidate {
  return {
    sourceRecordKey: OFFER_KEY, sourcePostId: 18932, sourcePostType: "hb-programs", sourceStatus: "publish", legacyAuthorId: 7,
    publishedAt: "2026-01-01 00:00:00", modifiedAt: "2026-01-01 00:00:00",
    title: "Golden", slug: "golden", content: "Content", excerpt: "", shortDescription: null,
    priceText: "from 10", priceTextRaw: "from 10", averageCheck: { raw: "10", parsed: 10 }, durationMinutes: { raw: null, parsed: null }, maxGuests: { raw: null, parsed: null },
    classificationStatus: "UNCLASSIFIED", sourceTerms: [],
    placeRelation: { status: "SINGLE_PLACE_RELATION", placeSourcePostIds: [100], relations: [relation(100)] },
    booking: { raw: null, parsed: null, schemaVariant: null }, ageTerms: [],
    media: { galleryAttachmentIds: [], coverAttachmentId: null },
    seo: { title: null, description: null, focusKeyword: null, canonicalUrl: null, robots: null, ogTitle: null, ogDescription: null },
    oldSlugs: [], rawMeta: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fake Prisma pieces (in-memory, narrow to the interfaces these functions use)
// ---------------------------------------------------------------------------

interface FakeLineageRow {
  id: string;
  sourceId: string;
  sourceRecordKey: string;
  targetType: MigrationTargetType;
  targetRole: string;
  targetId: string | null;
  lastSourceHash: string | null;
  isActive: boolean;
}

function fakePrisma(input: {
  lineages?: FakeLineageRow[];
  offers?: Array<Partial<Offer> & { id: string; createRequestId: string | null }>;
  places?: Record<string, { id: string; createdByUserId: string | null; ownerBusinessId: string | null; cityId: string | null }>;
  businesses?: Record<string, { id: string }>;
}): OffersProductionWiringPrismaClient {
  const lineages = input.lineages ?? [];
  const offers = input.offers ?? [];
  const places = input.places ?? {};
  const businesses = input.businesses ?? {};
  return {
    migrationLineage: {
      findMany: (async (args: { where: { sourceId: string; sourceRecordKey: string; targetType: string; targetRole?: string; isActive: boolean } }) =>
        lineages.filter(
          (row) =>
            row.sourceId === args.where.sourceId &&
            row.sourceRecordKey === args.where.sourceRecordKey &&
            row.targetType === args.where.targetType &&
            row.isActive === args.where.isActive &&
            (args.where.targetRole === undefined || row.targetRole === args.where.targetRole),
        )) as unknown as OffersProductionWiringPrismaClient["migrationLineage"]["findMany"],
    },
    offer: {
      findMany: (async (args: { where: { createRequestId: string } }) =>
        offers.filter((o) => o.createRequestId === args.where.createRequestId)) as unknown as OffersProductionWiringPrismaClient["offer"]["findMany"],
      create: (async () => { throw new Error("not used in these tests") }) as unknown as OffersProductionWiringPrismaClient["offer"]["create"],
      updateMany: (async () => { throw new Error("not used in these tests") }) as unknown as OffersProductionWiringPrismaClient["offer"]["updateMany"],
    },
    place: {
      findUnique: (async (args: { where: { id: string } }) => places[args.where.id] ?? null) as unknown as OffersProductionWiringPrismaClient["place"]["findUnique"],
    },
    business: {
      findUnique: (async (args: { where: { id: string } }) => businesses[args.where.id] ?? null) as unknown as OffersProductionWiringPrismaClient["business"]["findUnique"],
    },
  };
}

// ---------------------------------------------------------------------------
// createOffersTargetStateResolver
// ---------------------------------------------------------------------------

async function testTargetStateResolverCleanTarget(): Promise<void> {
  const prisma = fakePrisma({});
  const resolve = createOffersTargetStateResolver(prisma, SOURCE_ID);
  const state = await resolve(fixtureCandidate());
  assert.deepEqual(state, { lineageCount: 0, targetExists: false, duplicateTarget: false, lineageDomainHash: null });
}

async function testTargetStateResolverRerunMatch(): Promise<void> {
  const prisma = fakePrisma({
    lineages: [{ id: "l1", sourceId: SOURCE_ID, sourceRecordKey: OFFER_KEY, targetType: "OFFER", targetRole: "primary", targetId: "offer-1", lastSourceHash: "offer-domain-v2:fixture", isActive: true }],
    offers: [{ id: "offer-1", createRequestId: OFFER_KEY }],
  });
  const resolve = createOffersTargetStateResolver(prisma, SOURCE_ID);
  const state = await resolve(fixtureCandidate());
  assert.equal(state.lineageCount, 1);
  assert.equal(state.targetExists, true);
  assert.equal(state.lineageDomainHash, "offer-domain-v2:fixture");
}

async function testTargetStateResolverDuplicateTarget(): Promise<void> {
  const prisma = fakePrisma({ offers: [{ id: "offer-1", createRequestId: OFFER_KEY }, { id: "offer-2", createRequestId: OFFER_KEY }] });
  const resolve = createOffersTargetStateResolver(prisma, SOURCE_ID);
  const state = await resolve(fixtureCandidate());
  assert.equal(state.duplicateTarget, true);
}

// ---------------------------------------------------------------------------
// createOffersDependencyResolver
// ---------------------------------------------------------------------------

function placeLineage(overrides: Partial<FakeLineageRow> = {}): FakeLineageRow {
  return { id: "pl1", sourceId: SOURCE_ID, sourceRecordKey: PLACE_KEY, targetType: "PLACE", targetRole: "primary", targetId: "place-1", lastSourceHash: null, isActive: true, ...overrides };
}

async function testDependencyResolverHappyPathNoBusiness(): Promise<void> {
  const prisma = fakePrisma({ lineages: [placeLineage()], places: { "place-1": { id: "place-1", createdByUserId: "user-1", ownerBusinessId: null, cityId: "city-1" } } });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  const deps = await resolve(fixtureCandidate());
  assert.deepEqual(deps, { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" });
}

async function testDependencyResolverHappyPathWithBusiness(): Promise<void> {
  const prisma = fakePrisma({
    lineages: [placeLineage()],
    places: { "place-1": { id: "place-1", createdByUserId: "user-1", ownerBusinessId: "biz-1", cityId: "city-1" } },
    businesses: { "biz-1": { id: "biz-1" } },
  });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  const deps = await resolve(fixtureCandidate({ dependencyPlan: { placeSourceRecordKey: PLACE_KEY, businessSourceKey: "place-owner-business:" + PLACE_KEY, placeReadiness: "EXISTS_NOW", businessReadiness: "EXISTS_NOW" } }));
  assert.equal(deps.businessId, "biz-1");
}

async function expectRejectMessage(action: () => Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof Error && error.message === message);
}

async function testDependencyResolverZeroPlaceLineageFails(): Promise<void> {
  const prisma = fakePrisma({});
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  await expectRejectMessage(() => resolve(fixtureCandidate()), "PLACE_DEPENDENCY_NOT_FOUND");
}

async function testDependencyResolverAmbiguousPlaceLineageFails(): Promise<void> {
  const prisma = fakePrisma({ lineages: [placeLineage({ id: "pl1" }), placeLineage({ id: "pl2", targetId: "place-2" })] });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  await expectRejectMessage(() => resolve(fixtureCandidate()), "PLACE_DEPENDENCY_AMBIGUOUS");
}

async function testDependencyResolverPlaceTargetMissingFails(): Promise<void> {
  const prisma = fakePrisma({ lineages: [placeLineage()] });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  await expectRejectMessage(() => resolve(fixtureCandidate()), "PLACE_DEPENDENCY_TARGET_MISSING");
}

async function testDependencyResolverMissingCityFails(): Promise<void> {
  const prisma = fakePrisma({ lineages: [placeLineage()], places: { "place-1": { id: "place-1", createdByUserId: "user-1", ownerBusinessId: null, cityId: null } } });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  await expectRejectMessage(() => resolve(fixtureCandidate()), "PLACE_DEPENDENCY_MISSING_CITY");
}

async function testDependencyResolverBusinessTargetMissingFails(): Promise<void> {
  const prisma = fakePrisma({ lineages: [placeLineage()], places: { "place-1": { id: "place-1", createdByUserId: "user-1", ownerBusinessId: "biz-1", cityId: "city-1" } } });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  await expectRejectMessage(() => resolve(fixtureCandidate()), "BUSINESS_DEPENDENCY_TARGET_MISSING");
}

async function testDependencyResolverBusinessExpectedButAbsentFails(): Promise<void> {
  const prisma = fakePrisma({ lineages: [placeLineage()], places: { "place-1": { id: "place-1", createdByUserId: "user-1", ownerBusinessId: null, cityId: "city-1" } } });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  const candidate = fixtureCandidate({ dependencyPlan: { placeSourceRecordKey: PLACE_KEY, businessSourceKey: "place-owner-business:" + PLACE_KEY, placeReadiness: "EXISTS_NOW", businessReadiness: "EXISTS_NOW" } });
  await expectRejectMessage(() => resolve(candidate), "BUSINESS_DEPENDENCY_NOT_FOUND");
}

async function testDependencyResolverBusinessUnexpectedButPresentFails(): Promise<void> {
  const prisma = fakePrisma({
    lineages: [placeLineage()],
    places: { "place-1": { id: "place-1", createdByUserId: "user-1", ownerBusinessId: "biz-1", cityId: "city-1" } },
    businesses: { "biz-1": { id: "biz-1" } },
  });
  const resolve = createOffersDependencyResolver(prisma, SOURCE_ID);
  await expectRejectMessage(() => resolve(fixtureCandidate()), "BUSINESS_DEPENDENCY_UNEXPECTED");
}

// ---------------------------------------------------------------------------
// createOffersWriter
// ---------------------------------------------------------------------------

function fakeWriterPrisma(input: { offerCreate: (data: unknown) => Promise<{ id: string }> }): OffersWriterPrismaClient {
  const lineageRows = new Map<string, { id: string; targetId: string }>();
  return {
    migrationLineage: {
      findMany: (async () => []) as unknown as OffersWriterPrismaClient["migrationLineage"]["findMany"],
      create: (async ({ data }: { data: { targetId: string } }) => {
        const id = `lineage-${lineageRows.size + 1}`;
        lineageRows.set(id, { id, targetId: data.targetId });
        return { id, ...data };
      }) as unknown as OffersWriterPrismaClient["migrationLineage"]["create"],
      updateMany: (async () => ({ count: 0 })) as unknown as OffersWriterPrismaClient["migrationLineage"]["updateMany"],
      findUnique: (async () => null) as unknown as OffersWriterPrismaClient["migrationLineage"]["findUnique"],
      findUniqueOrThrow: (async () => { throw new Error("not used: no reactivation expected on a clean target") }) as unknown as OffersWriterPrismaClient["migrationLineage"]["findUniqueOrThrow"],
    },
    offer: {
      findMany: (async () => []) as unknown as OffersWriterPrismaClient["offer"]["findMany"],
      create: (async ({ data }: { data: unknown }) => input.offerCreate(data)) as unknown as OffersWriterPrismaClient["offer"]["create"],
      updateMany: (async () => { throw new Error("not used in these tests") }) as unknown as OffersWriterPrismaClient["offer"]["updateMany"],
    },
    place: { findUnique: (async () => null) as unknown as OffersWriterPrismaClient["place"]["findUnique"] },
    business: { findUnique: (async () => null) as unknown as OffersWriterPrismaClient["business"]["findUnique"] },
  };
}

async function testWriterThrowsWhenRawSourceUnavailable(): Promise<void> {
  const rawSource: RawOfferSourceRepository = {
    loadNormalizedCandidate: () => { throw new Error("OFFER_RAW_SOURCE_UNAVAILABLE") },
  };
  const prisma = fakeWriterPrisma({ offerCreate: async () => ({ id: "should-not-be-called" }) });
  const write = createOffersWriter(prisma, rawSource, SOURCE_ID, "METADATA");
  await expectRejectMessage(
    () => write(fixtureCandidate(), { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" }),
    "OFFER_RAW_SOURCE_UNAVAILABLE",
  );
}

async function testWriterHappyPathCreatesOfferAndLineage(): Promise<void> {
  const rawCandidate = fixtureRawCandidate();
  const dependencyPlan = { placeSourceRecordKey: PLACE_KEY, businessSourceKey: null, placeReadiness: "EXISTS_NOW" as const, businessReadiness: null };
  const domainHashV2 = buildOfferDomainHashV2(rawCandidate, {
    placeSourceRecordKey: PLACE_KEY,
    ownerIdentity: { kind: "technicalMigrationCreator", value: "technicalMigrationCreator" },
    businessSourceKey: null,
  });
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => rawCandidate };
  let created: unknown = null;
  const prisma = fakeWriterPrisma({ offerCreate: async (data) => { created = data; return { id: "offer-new-1" } } });
  const write = createOffersWriter(prisma, rawSource, SOURCE_ID, "METADATA");
  const result = await write(fixtureCandidate({ domainHashV2, dependencyPlan }), { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" });
  assert.equal(result.targetId, "offer-new-1");
  assert.equal((created as { placeId: string }).placeId, "place-1");
  assert.equal((created as { createRequestId: string }).createRequestId, OFFER_KEY);
}

async function testWriterRejectsOnDomainHashMismatch(): Promise<void> {
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate() };
  const prisma = fakeWriterPrisma({ offerCreate: async () => ({ id: "should-not-be-created" }) });
  const write = createOffersWriter(prisma, rawSource, SOURCE_ID, "METADATA");
  await expectRejectMessage(
    () => write(fixtureCandidate({ domainHashV2: "offer-domain-v2:stale" }), { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" }),
    "DOMAIN_HASH_RECOMPUTE_MISMATCH",
  );
}

async function main(): Promise<void> {
  await testTargetStateResolverCleanTarget();
  await testTargetStateResolverRerunMatch();
  await testTargetStateResolverDuplicateTarget();
  await testDependencyResolverHappyPathNoBusiness();
  await testDependencyResolverHappyPathWithBusiness();
  await testDependencyResolverZeroPlaceLineageFails();
  await testDependencyResolverAmbiguousPlaceLineageFails();
  await testDependencyResolverPlaceTargetMissingFails();
  await testDependencyResolverMissingCityFails();
  await testDependencyResolverBusinessTargetMissingFails();
  await testDependencyResolverBusinessExpectedButAbsentFails();
  await testDependencyResolverBusinessUnexpectedButPresentFails();
  await testWriterThrowsWhenRawSourceUnavailable();
  await testWriterHappyPathCreatesOfferAndLineage();
  await testWriterRejectsOnDomainHashMismatch();
  console.log("Phoenix Offers production wiring tests: PASS");
}

void main();
