import assert from "node:assert/strict";
import type { MigrationLineage, MigrationTargetType, Offer } from "@prisma/client";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { buildOfferDomainHashV2 } from "../../commit/offer/offerDomainHash";
import { SequentialEntityPhaseAdapter } from "../adapter";
import {
  createOffersDependencyResolver,
  createOffersTargetStateResolver,
  createOffersWriter,
  type OffersProductionWiringPrismaClient,
  type OffersWriterPrismaClient,
  type OffersWriteTransactionClient,
  type RawOfferSourceRepository,
} from "./offersProductionWiring";
import { OffersPhaseExecutor, type OffersMigrationCandidate, type OffersMigrationDependencies } from "./offersAdapter";

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

/**
 * A real transactional fake: writes performed inside the `$transaction`
 * callback are only visible in `committedOffers`/`committedLineages` after
 * the callback resolves. If the callback throws (either writer rejects),
 * nothing staged during that attempt is ever committed — this is what lets
 * the rollback tests below prove real commit/rollback semantics, not just
 * "the function that would have written wasn't called."
 */
function createTransactionalOffersFake(input: { offerShouldFail?: boolean; lineageShouldFail?: boolean } = {}) {
  const committedOffers: Array<Record<string, unknown> & { id: string }> = [];
  const committedLineages: Array<Record<string, unknown> & { id: string }> = [];
  let offerCreateCalls = 0;
  let lineageCreateCalls = 0;

  const prisma: OffersWriterPrismaClient = {
    $transaction: (async (fn: (tx: OffersWriteTransactionClient) => Promise<unknown>) => {
      const stagedOffers: Array<Record<string, unknown> & { id: string }> = [];
      const stagedLineages: Array<Record<string, unknown> & { id: string }> = [];
      const tx: OffersWriteTransactionClient = {
        offer: {
          create: (async ({ data }: { data: Record<string, unknown> }) => {
            offerCreateCalls += 1;
            if (input.offerShouldFail) throw new Error("OFFER_CREATE_FAILED_SIMULATED");
            const row = { id: `offer-${stagedOffers.length + 1}`, ...data };
            stagedOffers.push(row);
            return row;
          }) as unknown as OffersWriteTransactionClient["offer"]["create"],
          updateMany: (async () => { throw new Error("not used in these tests") }) as unknown as OffersWriteTransactionClient["offer"]["updateMany"],
        },
        migrationLineage: {
          create: (async ({ data }: { data: Record<string, unknown> }) => {
            lineageCreateCalls += 1;
            if (input.lineageShouldFail) throw new Error("LINEAGE_CREATE_FAILED_SIMULATED");
            const row = { id: `lineage-${stagedLineages.length + 1}`, ...data };
            stagedLineages.push(row);
            return row;
          }) as unknown as OffersWriteTransactionClient["migrationLineage"]["create"],
          updateMany: (async () => ({ count: 0 })) as unknown as OffersWriteTransactionClient["migrationLineage"]["updateMany"],
          findUnique: (async () => null) as unknown as OffersWriteTransactionClient["migrationLineage"]["findUnique"],
          findUniqueOrThrow: (async () => { throw new Error("not used: no reactivation expected on a clean target") }) as unknown as OffersWriteTransactionClient["migrationLineage"]["findUniqueOrThrow"],
        },
      };
      // No try/catch here on purpose: a real Postgres transaction never
      // commits anything from an attempt whose callback throws, so letting
      // the rejection propagate untouched (staged rows simply discarded,
      // never pushed onto the committed arrays) is the accurate model.
      const result = await fn(tx);
      committedOffers.push(...stagedOffers);
      committedLineages.push(...stagedLineages);
      return result;
    }) as OffersWriterPrismaClient["$transaction"],
  };

  return {
    prisma,
    committedOffers: () => committedOffers,
    committedLineages: () => committedLineages,
    offerCreateCalls: () => offerCreateCalls,
    lineageCreateCalls: () => lineageCreateCalls,
  };
}

function fixtureDependencyPlan(): OffersMigrationCandidate["dependencyPlan"] {
  return { placeSourceRecordKey: PLACE_KEY, businessSourceKey: null, placeReadiness: "EXISTS_NOW", businessReadiness: null };
}

function fixtureDomainHash(rawCandidate: NormalizedOfferCandidate): string {
  return buildOfferDomainHashV2(rawCandidate, {
    placeSourceRecordKey: PLACE_KEY,
    ownerIdentity: { kind: "technicalMigrationCreator", value: "technicalMigrationCreator" },
    businessSourceKey: null,
  });
}

const RESOLVED_DEPS = { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" };

async function testWriterThrowsWhenRawSourceUnavailable(): Promise<void> {
  const rawSource: RawOfferSourceRepository = {
    loadNormalizedCandidate: () => { throw new Error("OFFER_RAW_SOURCE_UNAVAILABLE") },
  };
  const fake = createTransactionalOffersFake();
  const write = createOffersWriter(fake.prisma, rawSource, SOURCE_ID, "METADATA");
  await expectRejectMessage(() => write(fixtureCandidate(), RESOLVED_DEPS), "OFFER_RAW_SOURCE_UNAVAILABLE");
  assert.equal(fake.offerCreateCalls(), 0, "the transaction must never open when the raw source is unavailable");
}

async function testWriterRejectsOnDomainHashMismatch(): Promise<void> {
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate() };
  const fake = createTransactionalOffersFake();
  const write = createOffersWriter(fake.prisma, rawSource, SOURCE_ID, "METADATA");
  await expectRejectMessage(
    () => write(fixtureCandidate({ domainHashV2: "offer-domain-v2:stale" }), RESOLVED_DEPS),
    "DOMAIN_HASH_RECOMPUTE_MISMATCH",
  );
  assert.equal(fake.offerCreateCalls(), 0, "the transaction must never open when the domain hash fails to recompute");
}

async function testWriterTransactionCommitsOfferAndLineageTogether(): Promise<void> {
  const rawCandidate = fixtureRawCandidate();
  const domainHashV2 = fixtureDomainHash(rawCandidate);
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => rawCandidate };
  const fake = createTransactionalOffersFake();
  const write = createOffersWriter(fake.prisma, rawSource, SOURCE_ID, "METADATA");

  const result = await write(fixtureCandidate({ domainHashV2, dependencyPlan: fixtureDependencyPlan() }), RESOLVED_DEPS);

  assert.equal(fake.offerCreateCalls(), 1);
  assert.equal(fake.lineageCreateCalls(), 1);
  assert.equal(fake.committedOffers().length, 1, "the Offer must be committed exactly once");
  assert.equal(fake.committedLineages().length, 1, "the lineage must be committed exactly once, in the same transaction attempt");
  assert.equal(result.targetId, fake.committedOffers()[0].id);
  assert.equal(fake.committedOffers()[0].placeId, "place-1");
  assert.equal(fake.committedOffers()[0].createRequestId, OFFER_KEY);
  assert.equal(fake.committedLineages()[0].targetId, result.targetId, "both writes happened against the same transaction attempt");
}

async function testWriterLineageFailureRollsBackOffer(): Promise<void> {
  const rawCandidate = fixtureRawCandidate();
  const domainHashV2 = fixtureDomainHash(rawCandidate);
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => rawCandidate };
  const fake = createTransactionalOffersFake({ lineageShouldFail: true });
  const write = createOffersWriter(fake.prisma, rawSource, SOURCE_ID, "METADATA");

  await expectRejectMessage(
    () => write(fixtureCandidate({ domainHashV2, dependencyPlan: fixtureDependencyPlan() }), RESOLVED_DEPS),
    "LINEAGE_CREATE_FAILED_SIMULATED",
  );

  assert.equal(fake.offerCreateCalls(), 1, "the Offer create was attempted inside the transaction");
  assert.equal(fake.lineageCreateCalls(), 1, "the lineage create was attempted and failed");
  assert.equal(fake.committedOffers().length, 0, "no Offer may survive a failed lineage write — the transaction must roll it back");
  assert.equal(fake.committedLineages().length, 0);
}

async function testWriterOfferFailureNeverCallsLineageWriter(): Promise<void> {
  const rawCandidate = fixtureRawCandidate();
  const domainHashV2 = fixtureDomainHash(rawCandidate);
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => rawCandidate };
  const fake = createTransactionalOffersFake({ offerShouldFail: true });
  const write = createOffersWriter(fake.prisma, rawSource, SOURCE_ID, "METADATA");

  await expectRejectMessage(
    () => write(fixtureCandidate({ domainHashV2, dependencyPlan: fixtureDependencyPlan() }), RESOLVED_DEPS),
    "OFFER_CREATE_FAILED_SIMULATED",
  );

  assert.equal(fake.offerCreateCalls(), 1);
  assert.equal(fake.lineageCreateCalls(), 0, "the lineage writer must never run once the Offer create itself failed");
  assert.equal(fake.committedOffers().length, 0);
  assert.equal(fake.committedLineages().length, 0);
}

async function testExecutorStopsOnFirstErrorWhenWriteTransactionFails(): Promise<void> {
  const rawCandidate = fixtureRawCandidate();
  const domainHashV2 = fixtureDomainHash(rawCandidate);
  const rawSource: RawOfferSourceRepository = { loadNormalizedCandidate: () => rawCandidate };
  const fake = createTransactionalOffersFake({ lineageShouldFail: true });
  const write = createOffersWriter(fake.prisma, rawSource, SOURCE_ID, "METADATA");

  let secondRecordLoaded = false;
  const deps: OffersMigrationDependencies = {
    loadCandidate: (sourceRecordKey) => {
      if (sourceRecordKey !== OFFER_KEY) secondRecordLoaded = true;
      return fixtureCandidate({ sourceRecordKey, domainHashV2, dependencyPlan: fixtureDependencyPlan() });
    },
    resolveTargetState: async () => ({ lineageCount: 0, targetExists: false, duplicateTarget: false, lineageDomainHash: null }),
    resolveDependencies: async () => RESOLVED_DEPS,
    write,
  };
  const executor = new OffersPhaseExecutor(deps);
  const adapter = new SequentialEntityPhaseAdapter(executor);
  const phase = {
    name: "offers" as const,
    status: "READY" as const,
    artifacts: [],
    records: [
      { sourceRecordKey: OFFER_KEY, action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:hb-programs:99999", action: "CREATE" as const },
    ],
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "METADATA" as const,
    prerequisites: [],
  };

  const results = await adapter.apply(phase);

  assert.equal(results.length, 1, "must stop immediately after the first FAILED record");
  assert.equal(results[0].outcome, "FAILED");
  assert.equal(results[0].error, "LINEAGE_CREATE_FAILED_SIMULATED");
  assert.equal(secondRecordLoaded, false, "no subsequent record's writer may be invoked");
  assert.equal(fake.committedOffers().length, 0, "the failed record's Offer must not survive as an orphan");
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
  await testWriterRejectsOnDomainHashMismatch();
  await testWriterTransactionCommitsOfferAndLineageTogether();
  await testWriterLineageFailureRollsBackOffer();
  await testWriterOfferFailureNeverCallsLineageWriter();
  await testExecutorStopsOnFirstErrorWhenWriteTransactionFails();
  console.log("Phoenix Offers production wiring tests: PASS");
}

void main();
