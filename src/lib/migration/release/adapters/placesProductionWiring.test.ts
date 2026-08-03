import assert from "node:assert/strict";
import type { NormalizedPlaceCandidate } from "../../commit/place/types";
import {
  createPlacesDependencyResolver,
  createPlacesLoadCandidate,
  createPlacesTargetStateResolver,
  createPlacesWriter,
  type PlacesProductionWiringPrismaClient,
  type PlacesWriteTransactionClient,
  type PlacesWriterPrismaClient,
  type RawPlaceSourceRepository,
} from "./placesProductionWiring";

const SOURCE_ID = "source-1";
const PLACE_KEY = "wordpress-db:places:42";

interface FakeLineageRow {
  id: string; sourceId: string; sourceRecordKey: string; targetType: string; targetRole: string; targetId: string | null; lastSourceHash: string | null; isActive: boolean;
}

function fakeTargetPrisma(lineages: FakeLineageRow[]): PlacesProductionWiringPrismaClient {
  return {
    migrationLineage: {
      findMany: (async (args: { where: { sourceId: string; sourceRecordKey: string; targetType: string; isActive: boolean } }) =>
        lineages.filter((row) => row.sourceId === args.where.sourceId && row.sourceRecordKey === args.where.sourceRecordKey && row.targetType === args.where.targetType && row.isActive === args.where.isActive)) as unknown as PlacesProductionWiringPrismaClient["migrationLineage"]["findMany"],
    },
  };
}

async function testTargetStateResolverCleanTarget(): Promise<void> {
  const resolve = createPlacesTargetStateResolver(fakeTargetPrisma([]), SOURCE_ID);
  assert.deepEqual(await resolve({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:1" } }), { lineageCount: 0, targetExists: false, lineageDomainHash: null });
}

async function testDependencyResolverHappyPath(): Promise<void> {
  const prisma = fakeTargetPrisma([{ id: "l1", sourceId: SOURCE_ID, sourceRecordKey: "wordpress-db:user:7", targetType: "USER", targetRole: "primary", targetId: "user-7", lastSourceHash: null, isActive: true }]);
  const resolve = createPlacesDependencyResolver(prisma, SOURCE_ID);
  const deps = await resolve({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } });
  assert.equal(deps.createdByUserId, "user-7");
}

async function expectRejectMessage(action: () => Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof Error && error.message === message);
}

async function testDependencyResolverZeroMatchesFails(): Promise<void> {
  const resolve = createPlacesDependencyResolver(fakeTargetPrisma([]), SOURCE_ID);
  await expectRejectMessage(() => resolve({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }), "PLACE_OWNER_DEPENDENCY_NOT_FOUND");
}

async function testLoadCandidateComposesFromRawSource(): Promise<void> {
  const rawSource: RawPlaceSourceRepository = {
    loadNormalizedCandidate: () => ({}) as NormalizedPlaceCandidate,
    loadLegacyAuthorId: () => 7,
    loadSourceHash: () => "wordpress-db-domain-v2:fixture",
  };
  const loadCandidate = createPlacesLoadCandidate(rawSource);
  const candidate = loadCandidate(PLACE_KEY);
  assert.equal(candidate.dependencyPlan.ownerUserSourceRecordKey, "wordpress-db:user:7");
  assert.equal(candidate.domainHash, "wordpress-db-domain-v2:fixture");
}

function createTransactionalPlacesFake(input: { placeShouldFail?: boolean; lineageShouldFail?: boolean } = {}) {
  const committedPlaces: Array<Record<string, unknown> & { id: string }> = [];
  const committedLineages: Array<Record<string, unknown> & { id: string }> = [];
  let placeCreateCalls = 0;
  let lineageCreateCalls = 0;
  const prisma: PlacesWriterPrismaClient = {
    city: { findMany: (async () => []) as unknown as PlacesWriterPrismaClient["city"]["findMany"] },
    $transaction: (async (fn: (tx: PlacesWriteTransactionClient) => Promise<unknown>) => {
      const stagedPlaces: Array<Record<string, unknown> & { id: string }> = [];
      const stagedLineages: Array<Record<string, unknown> & { id: string }> = [];
      const tx: PlacesWriteTransactionClient = {
        place: {
          create: (async ({ data }: { data: Record<string, unknown> }) => {
            placeCreateCalls += 1;
            if (input.placeShouldFail) throw new Error("PLACE_CREATE_FAILED_SIMULATED");
            const row = { id: `place-${stagedPlaces.length + 1}`, ...data };
            stagedPlaces.push(row);
            return row;
          }) as unknown as PlacesWriteTransactionClient["place"]["create"],
          update: (async () => { throw new Error("not used") }) as unknown as PlacesWriteTransactionClient["place"]["update"],
          findUnique: (async () => null) as unknown as PlacesWriteTransactionClient["place"]["findUnique"],
        },
        openingHours: {
          create: (async () => { throw new Error("opening hours deferred, must not be called") }) as unknown as PlacesWriteTransactionClient["openingHours"]["create"],
          update: (async () => { throw new Error("not used") }) as unknown as PlacesWriteTransactionClient["openingHours"]["update"],
        },
        migrationLineage: {
          create: (async ({ data }: { data: Record<string, unknown> }) => {
            lineageCreateCalls += 1;
            if (input.lineageShouldFail) throw new Error("LINEAGE_CREATE_FAILED_SIMULATED");
            const row = { id: `lineage-${stagedLineages.length + 1}`, ...data };
            stagedLineages.push(row);
            return row;
          }) as unknown as PlacesWriteTransactionClient["migrationLineage"]["create"],
          updateMany: (async () => ({ count: 0 })) as unknown as PlacesWriteTransactionClient["migrationLineage"]["updateMany"],
          findUnique: (async () => null) as unknown as PlacesWriteTransactionClient["migrationLineage"]["findUnique"],
          findUniqueOrThrow: (async () => { throw new Error("not used") }) as unknown as PlacesWriteTransactionClient["migrationLineage"]["findUniqueOrThrow"],
        },
        $transaction: (async (nested) => nested(tx)) as PlacesWriteTransactionClient["$transaction"],
      };
      const result = await fn(tx);
      committedPlaces.push(...stagedPlaces);
      committedLineages.push(...stagedLineages);
      return result;
    }) as PlacesWriterPrismaClient["$transaction"],
  };
  return { prisma, committedPlaces: () => committedPlaces, committedLineages: () => committedLineages, placeCreateCalls: () => placeCreateCalls, lineageCreateCalls: () => lineageCreateCalls };
}

function fixtureRawCandidate(overrides: Partial<NormalizedPlaceCandidate> = {}): NormalizedPlaceCandidate {
  return {
    title: "Golden Place", slug: "golden-place", content: "Body", excerpt: "", status: "publish",
    publishedAt: "2026-01-01 00:00:00", modifiedAt: "2026-01-01 00:00:00", shortDescription: "Short desc",
    phone: null, phoneE164: null, email: null, workHoursRaw: null, openingHours: null, locationRaw: null,
    cityRaw: null, addressText: null,
    ...overrides,
  } as unknown as NormalizedPlaceCandidate;
}

function fakeCityPrisma(cities: Array<{ id: string; name: string }>, transactional: ReturnType<typeof createTransactionalPlacesFake>): PlacesWriterPrismaClient {
  return {
    city: { findMany: (async () => cities) as unknown as PlacesWriterPrismaClient["city"]["findMany"] },
    $transaction: transactional.prisma.$transaction,
  };
}

// --- City dependency resolution: happy path, not-found, ambiguous, mismatch,
// and the address-text fallback path — the exact mechanism root-caused for
// wordpress-db:places:5528 (see docs/migration/prelaunch-checklist.md §J/§K:
// a genuine missing-City-seed gap, not a resolver defect — these tests prove
// the resolver's own behavior is already correct on every path).

async function testCityResolutionHappyPathSingleExactMatch(): Promise<void> {
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ cityRaw: "Минск" }), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const prisma = fakeCityPrisma([{ id: "city-minsk", name: "Минск" }], fake);
  const write = createPlacesWriter(prisma, rawSource, SOURCE_ID);
  const result = await write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" });
  assert.equal(result.targetId, fake.committedPlaces()[0].id);
  assert.equal(fake.committedPlaces()[0].cityId, "city-minsk");
}

async function testCityResolutionNotFoundFailsClosed(): Promise<void> {
  // Exactly the wordpress-db:places:5528 shape: a real, legitimate city name
  // ("Копище") with zero matching active City rows — never silently
  // defaulted, created, or dropped.
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ cityRaw: "Копище" }), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const prisma = fakeCityPrisma([], fake);
  const write = createPlacesWriter(prisma, rawSource, SOURCE_ID);
  await expectRejectMessage(
    () => write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" }),
    "PLACE_CITY_DEPENDENCY_NOT_FOUND",
  );
  assert.equal(fake.committedPlaces().length, 0, "no Place may be written when its City dependency cannot be resolved");
}

async function testCityResolutionAmbiguousFailsClosed(): Promise<void> {
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ cityRaw: "Минск" }), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const prisma = fakeCityPrisma([{ id: "city-a", name: "Минск" }, { id: "city-b", name: "Минск" }], fake);
  const write = createPlacesWriter(prisma, rawSource, SOURCE_ID);
  await expectRejectMessage(
    () => write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" }),
    "PLACE_CITY_DEPENDENCY_AMBIGUOUS",
  );
  assert.equal(fake.committedPlaces().length, 0);
}

async function testCityResolutionCaseNormalizationMismatchFailsClosed(): Promise<void> {
  // A defensive second check beyond the DB's own case-insensitive query —
  // simulated here with a fake that (unlike real Postgres collation) can
  // return a name that doesn't actually match, to prove this check is real
  // and load-bearing, not dead code.
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ cityRaw: "Минск" }), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const prisma = fakeCityPrisma([{ id: "city-a", name: "Совершенно другой город" }], fake);
  const write = createPlacesWriter(prisma, rawSource, SOURCE_ID);
  await expectRejectMessage(
    () => write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" }),
    "PLACE_CITY_DEPENDENCY_MISMATCH",
  );
  assert.equal(fake.committedPlaces().length, 0);
}

async function testCityResolutionAddressTextFallbackMatchesExactSegment(): Promise<void> {
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ cityRaw: null, addressText: "улица Ленина 1, Минск, Беларусь" }), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const prisma = fakeCityPrisma([{ id: "city-minsk", name: "Минск" }], fake);
  const write = createPlacesWriter(prisma, rawSource, SOURCE_ID);
  const result = await write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" });
  assert.equal(fake.committedPlaces()[0].cityId, "city-minsk");
  assert.ok(result.targetId);
}

async function testCityResolutionAddressTextFallbackNoMatchLeavesCityNull(): Promise<void> {
  // Unlike the cityRaw path, zero address-segment matches is not itself a
  // failure — the record simply gets created without a resolved City. This
  // is deliberate existing behavior (never a guessed match), verified here
  // so a future change can't silently start throwing on this path too.
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ cityRaw: null, addressText: "улица Авиационная 16, Копище, Беларусь" }), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const prisma = fakeCityPrisma([{ id: "city-minsk", name: "Минск" }], fake);
  const write = createPlacesWriter(prisma, rawSource, SOURCE_ID);
  const result = await write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" });
  assert.equal(fake.committedPlaces()[0].cityId, null);
  assert.ok(result.targetId);
}

async function testWriterCommitsPlaceAndLineageTogether(): Promise<void> {
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate(), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake();
  const write = createPlacesWriter(fake.prisma, rawSource, SOURCE_ID);
  const result = await write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" });
  assert.equal(fake.placeCreateCalls(), 1);
  assert.equal(fake.lineageCreateCalls(), 1);
  assert.equal(fake.committedPlaces().length, 1);
  assert.equal(result.targetId, fake.committedPlaces()[0].id);
}

async function testWriterLineageFailureRollsBackPlace(): Promise<void> {
  const rawSource: RawPlaceSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate(), loadLegacyAuthorId: () => 7, loadSourceHash: () => "h" };
  const fake = createTransactionalPlacesFake({ lineageShouldFail: true });
  const write = createPlacesWriter(fake.prisma, rawSource, SOURCE_ID);
  await assert.rejects(() => write({ sourceRecordKey: PLACE_KEY, domainHash: "h", dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:7" } }, { createdByUserId: "user-7" }), /LINEAGE_CREATE_FAILED_SIMULATED/);
  assert.equal(fake.committedPlaces().length, 0, "no Place may survive a failed lineage write");
}

async function main(): Promise<void> {
  await testTargetStateResolverCleanTarget();
  await testDependencyResolverHappyPath();
  await testDependencyResolverZeroMatchesFails();
  await testLoadCandidateComposesFromRawSource();
  await testWriterCommitsPlaceAndLineageTogether();
  await testWriterLineageFailureRollsBackPlace();
  await testCityResolutionHappyPathSingleExactMatch();
  await testCityResolutionNotFoundFailsClosed();
  await testCityResolutionAmbiguousFailsClosed();
  await testCityResolutionCaseNormalizationMismatchFailsClosed();
  await testCityResolutionAddressTextFallbackMatchesExactSegment();
  await testCityResolutionAddressTextFallbackNoMatchLeavesCityNull();
  console.log("Phoenix Places production wiring tests: PASS");
}

void main();
