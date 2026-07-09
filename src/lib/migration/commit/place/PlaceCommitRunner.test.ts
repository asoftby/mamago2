import assert from "node:assert/strict";

import type { MigrationLineage, MigrationRecord } from "@prisma/client";

import { PlaceCommitRunner } from "./PlaceCommitRunner";
import type {
  ExecutePlaceCommitRunInput,
  MigrationLineageWriterLike,
  PlaceCommitOrchestratorLike,
  PlaceCommitRunnerPrismaClient,
} from "./PlaceCommitRunner";
import type { ExecutePlaceCommitResult } from "./PlaceCommitOrchestrator";
import type { CreateLineageResult } from "../../lineage/types";
import type { CommitOperation } from "../types";
import type { NormalizedPlaceCandidate, PlaceCommitContext } from "./types";

function operationFixture(overrides: Partial<CommitOperation> = {}): CommitOperation {
  return {
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    action: "CREATE",
    order: 0,
    dependsOn: [],
    rollbackSteps: [],
    ...overrides,
  };
}

function recordFixture(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: "record-1",
    sourceId: "source-1",
    runId: "run-1",
    status: "PLANNED",
    sourceEntityType: "wordpress-db:places",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: "hash-a",
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: "PLACE",
    planAction: "CREATE",
    planSummary: { title: "Cool Place", slug: "cool-place" },
    validationSummary: null,
    dependencyRefs: null,
    mediaRefs: null,
    relationRefs: null,
    redirectRefs: null,
    attemptCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function candidateFixture(overrides: Partial<NormalizedPlaceCandidate> = {}): NormalizedPlaceCandidate {
  return {
    title: "Cool Place",
    slug: "cool-place",
    content: "<p>A cool place for kids.</p>",
    excerpt: "A cool place excerpt",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    shortDescription: "A great place for kids",
    phone: "+375291234567",
    email: "hello@example.com",
    workHoursRaw: "Mon-Fri 9-18",
    locationRaw: "Minsk, some street",
    cityRaw: "Minsk",
    coordinates: { lat: 53.9, lng: 27.5667 },
    media: { thumbnailAttachmentId: 555, galleryAttachmentIds: [111, 222] },
    seo: { title: "SEO Title", focusKeyword: "kids playground" },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<PlaceCommitContext> = {}): PlaceCommitContext {
  return {
    createdByUserId: "user-1",
    cityId: "city-1",
    category: "кафе",
    ...overrides,
  };
}

function inputFixture(overrides: Partial<ExecutePlaceCommitRunInput> = {}): ExecutePlaceCommitRunInput {
  return {
    operation: operationFixture(),
    record: recordFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
    ...overrides,
  };
}

function createFakeOrchestrator(result: ExecutePlaceCommitResult) {
  const calls: unknown[] = [];
  const orchestrator: PlaceCommitOrchestratorLike = {
    execute: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { orchestrator, calls };
}

function createFakeLineageWriter(options: { result?: CreateLineageResult; throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const writer: MigrationLineageWriterLike = {
    createLineage: async (input) => {
      calls.push(input);
      if (options.throwError) {
        throw options.throwError;
      }
      return (
        options.result ?? {
          lineageId: "lineage-1",
          sourceRecordKey: input.sourceRecordKey,
          targetType: input.targetType,
          targetId: input.targetId,
        }
      );
    },
  };
  return { writer, calls };
}

function createFakePrisma(options: { throwError?: Error; existingLineage?: MigrationLineage | null } = {}) {
  const calls: unknown[] = [];
  const prisma: PlaceCommitRunnerPrismaClient = {
    migrationRecord: {
      update: (async (args: unknown) => {
        calls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return recordFixture();
      }) as unknown as PlaceCommitRunnerPrismaClient["migrationRecord"]["update"],
    },
    migrationLineage: {
      findFirst: (async () => options.existingLineage ?? null) as unknown as PlaceCommitRunnerPrismaClient["migrationLineage"]["findFirst"],
      update: (async (args: unknown) => {
        calls.push(args);
        const existing = options.existingLineage ?? {
          id: "lineage-1",
          sourceRecordKey: "wordpress-db:places:301",
          targetType: "PLACE",
          targetId: "place-1",
        };
        return existing as unknown as MigrationLineage;
      }) as unknown as PlaceCommitRunnerPrismaClient["migrationLineage"]["update"],
    },
  };
  return { prisma, calls };
}

async function testHappyPath() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(result.placeId, "place-1");
  assert.equal(result.lineageId, "lineage-1");
  assert.equal(result.recordId, "record-1");
  assert.equal(result.status, "LINKED");

  assert.equal(lineageCalls.length, 1);
  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "record-1");
  assert.deepEqual(updateCall.data, { status: "LINKED", lastErrorCode: null, lastErrorMessage: null });
}

async function testOrchestratorBlockedMarksRecordFailedAndSkipsLineage() {
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    reasonCode: "PLACE_CREATE_BLOCKED",
    blockReasons: [{ code: "MISSING_CATEGORY", message: "no category chosen" }],
  });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.recordId, "record-1");
  assert.equal(lineageCalls.length, 0, "lineage must never be written for a blocked commit");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.match(updateCall.data.lastErrorMessage as string, /MISSING_CATEGORY/);
}

async function testOrchestratorFailedMarksRecordFailedAndSkipsLineage() {
  const writerError = new Error("db unavailable");
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    reasonCode: "PLACE_CREATE_FAILED",
    error: writerError,
  });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.error, writerError);
  assert.equal(lineageCalls.length, 0);

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "db unavailable");
}

async function testLineageThrowsMarksRecordFailedWithoutRollingBackPlace() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter({ throwError: new Error("lineage db down") });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.placeId, "place-1", "the already-created Place must still be reported, never hidden or rolled back");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "lineage db down");
}

async function testMigrationRecordUpdateThrowPropagatesRaw() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma({ throwError: new Error("update failed") });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  await assert.rejects(() => runner.execute(inputFixture()), /update failed/);
}

async function testSourceHashPassedUnchangedToLineageWriter() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture({ record: recordFixture({ sourceHash: "sha256-exact-value" }) }));

  const call = lineageCalls[0] as { lastSourceHash: string };
  assert.equal(call.lastSourceHash, "sha256-exact-value");
}

async function testPlaceIdNeverWrittenToMigrationRecord() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture());

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.ok(!("placeId" in updateCall.data));
  assert.ok(!("targetId" in updateCall.data));
}

async function testPlanSummaryAndNormalizedPayloadNeverTouched() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture());

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.deepEqual(
    new Set(Object.keys(updateCall.data)),
    new Set(["status", "lastErrorCode", "lastErrorMessage"]),
    "the update payload must only ever touch execution-status fields",
  );
}

async function main() {
  await testHappyPath();
  await testOrchestratorBlockedMarksRecordFailedAndSkipsLineage();
  await testOrchestratorFailedMarksRecordFailedAndSkipsLineage();
  await testLineageThrowsMarksRecordFailedWithoutRollingBackPlace();
  await testMigrationRecordUpdateThrowPropagatesRaw();
  await testSourceHashPassedUnchangedToLineageWriter();
  await testPlaceIdNeverWrittenToMigrationRecord();
  await testPlanSummaryAndNormalizedPayloadNeverTouched();
}

main()
  .then(() => {
    console.log("PlaceCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("PlaceCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });
