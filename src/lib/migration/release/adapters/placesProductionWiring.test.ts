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

function fixtureRawCandidate(): NormalizedPlaceCandidate {
  return {
    title: "Golden Place", slug: "golden-place", content: "Body", excerpt: "", status: "publish",
    publishedAt: "2026-01-01 00:00:00", modifiedAt: "2026-01-01 00:00:00", shortDescription: "Short desc",
    phone: null, phoneE164: null, email: null, workHoursRaw: null, openingHours: null, locationRaw: null,
  } as unknown as NormalizedPlaceCandidate;
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
  console.log("Phoenix Places production wiring tests: PASS");
}

void main();
