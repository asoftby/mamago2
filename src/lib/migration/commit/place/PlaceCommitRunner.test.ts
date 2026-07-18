import assert from "node:assert/strict";

import type { MigrationLineage, MigrationRecord, Place } from "@prisma/client";

import { PlaceCommitRunner } from "./PlaceCommitRunner";
import { classifyPlaceUpdateSafety } from "./classifyPlaceUpdateSafety";
import type {
  ExecutePlaceCommitRunInput,
  MigrationLineageWriterLike,
  PlaceCommitOrchestratorLike,
  PlaceCommitRunnerPrismaClient,
  PlaceMediaSyncerLike,
} from "./PlaceCommitRunner";
import type { PlaceUpdateConflictReason } from "./classifyPlaceUpdateSafety";
import type { ExecutePlaceCommitResult } from "./PlaceCommitOrchestrator";
import type { PlaceMediaSyncResult } from "./PlaceMediaSyncer";
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
    phoneE164: "+375291234567",
    openingHours: null,
    email: "hello@example.com",
    workHoursRaw: "Mon-Fri 9-18",
    locationRaw: "Minsk, some street",
    addressText: null,
    cityRaw: "Minsk",
    coordinates: { lat: 53.9, lng: 27.5667 },
    media: { thumbnailAttachmentId: 555, galleryAttachmentIds: [111, 222] },
    seo: { title: "SEO Title", focusKeyword: "kids playground" },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

const DEFAULT_LAST_IMPORTED_AT = new Date("2026-01-01T00:00:00.000Z");

function lineageFixture(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: "record-1",
    runId: "run-1",
    sourceEntityType: "wordpress-db:places",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
    targetRole: "primary",
    targetNaturalKey: null,
    lastSourceHash: "hash-a",
    lastPlanAction: null,
    isActive: true,
    firstSeenAt: DEFAULT_LAST_IMPORTED_AT,
    lastSeenAt: null,
    lastImportedAt: DEFAULT_LAST_IMPORTED_AT,
    createdAt: DEFAULT_LAST_IMPORTED_AT,
    updatedAt: DEFAULT_LAST_IMPORTED_AT,
    ...overrides,
  } as unknown as MigrationLineage;
}

/** Minimal — only `id`/`updatedAt` are ever read by the runner. */
function placeFixture(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    updatedAt: DEFAULT_LAST_IMPORTED_AT,
    ...overrides,
  } as unknown as Place;
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

function createFakePrisma(
  options: {
    throwError?: Error;
    /** `undefined` (the default) means "not configured" — used only by UPDATE tests, which always pass this explicitly. */
    existingLineage?: MigrationLineage | null;
    targetPlace?: Place | null;
  } = {},
) {
  const calls: unknown[] = [];
  const recordUpdateCalls: unknown[] = [];
  const lineageUpdateCalls: unknown[] = [];
  const placeFindUniqueCalls: unknown[] = [];
  const prisma: PlaceCommitRunnerPrismaClient = {
    migrationRecord: {
      update: (async (args: unknown) => {
        calls.push(args);
        recordUpdateCalls.push(args);
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
        lineageUpdateCalls.push(args);
        const existing = options.existingLineage ?? lineageFixture();
        const data = (args as { data: Record<string, unknown> }).data;
        return { ...existing, ...data } as unknown as MigrationLineage;
      }) as unknown as PlaceCommitRunnerPrismaClient["migrationLineage"]["update"],
    },
    place: {
      findUnique: (async (args: unknown) => {
        placeFindUniqueCalls.push(args);
        return options.targetPlace === undefined ? placeFixture() : options.targetPlace;
      }) as unknown as PlaceCommitRunnerPrismaClient["place"]["findUnique"],
    },
  };
  return { prisma, calls, recordUpdateCalls, lineageUpdateCalls, placeFindUniqueCalls };
}

const ZERO_MEDIA_COUNTS = { imported: 0, reused: 0, skipped: 0, failed: 0 };

function createFakeMediaSyncer(
  options: { result?: Partial<PlaceMediaSyncResult>; throwError?: Error } = {},
) {
  const calls: unknown[] = [];
  const syncer: PlaceMediaSyncerLike = {
    sync: async (input) => {
      calls.push(input);
      if (options.throwError) {
        throw options.throwError;
      }
      return { warnings: [], ...ZERO_MEDIA_COUNTS, ...options.result };
    },
  };
  return { syncer, calls };
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

// ---------------------------------------------------------------------------
// UPDATE safety — UPDATE_SAFE vs UPDATE_CONFLICT classification.
// ---------------------------------------------------------------------------

function updateOperationFixture(overrides: Partial<CommitOperation> = {}): CommitOperation {
  return operationFixture({ action: "UPDATE", ...overrides });
}

async function testUpdateSafeCallsWriterAndAdvancesLastImportedAt() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const fixedNow = new Date("2026-07-15T00:00:00.000Z");
  const { prisma, recordUpdateCalls, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture(),
    targetPlace: placeFixture(),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, now: () => fixedNow });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, true);
  assert.equal(result.status, "LINKED");
  assert.equal(result.placeId, "place-1");
  assert.equal(orchestratorCalls.length, 1);
  assert.equal((orchestratorCalls[0] as { targetPlaceId?: string }).targetPlaceId, "place-1");

  assert.equal(lineageUpdateCalls.length, 1);
  const lineageCall = lineageUpdateCalls[0] as { data: Record<string, unknown> };
  assert.equal(lineageCall.data.lastImportedAt, fixedNow, "a successful UPDATE must advance lastImportedAt");

  assert.equal(recordUpdateCalls.length, 1);
  assert.equal((recordUpdateCalls[0] as { data: Record<string, unknown> }).data.status, "LINKED");
}

async function testSharedClassifierUpdateSafeContract() {
  const { prisma } = createFakePrisma({
    existingLineage: lineageFixture({ targetId: "place-1" }),
    targetPlace: placeFixture({ id: "place-1", updatedAt: DEFAULT_LAST_IMPORTED_AT }),
  });

  const result = await classifyPlaceUpdateSafety({
    prisma,
    sourceId: "source-1",
    sourceRecordKey: "wordpress-db:places:301",
  });

  assert.equal(result.classification, "UPDATE_SAFE");
  assert.equal(result.targetId, "place-1");
}

async function testUpdateConflictLineageMissingNeverCallsWriter() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls, lineageUpdateCalls, placeFindUniqueCalls } = createFakePrisma({
    existingLineage: null,
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reasonCode, "PLACE_UPDATE_CONFLICT");
  assert.equal(result.conflictReason, "LINEAGE_MISSING" satisfies PlaceUpdateConflictReason);

  assert.equal(orchestratorCalls.length, 0, "writer must never be reached for a conflicted UPDATE");
  assert.equal(placeFindUniqueCalls.length, 0, "no lineage means there is no targetId to look up a Place by");
  assert.equal(lineageUpdateCalls.length, 0, "lineage must never be touched for a conflicted UPDATE");

  assert.equal(recordUpdateCalls.length, 1);
  const recordCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.equal(recordCall.data.status, "QUARANTINED", "a conflict is not an error — QUARANTINED, not FAILED");
  assert.equal(recordCall.data.lastErrorCode, "PLACE_UPDATE_CONFLICT");
}

async function testUpdateConflictLineageMismatchNeverTrustsUnfilteredFake() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  // Simulates a lineage row that doesn't actually belong to this record —
  // proves the runner verifies the returned row's own key fields rather
  // than blindly trusting that findFirst's WHERE clause filtered correctly.
  const { prisma, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture({ sourceRecordKey: "wordpress-db:places:999" }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.conflictReason, "LINEAGE_MISMATCH" satisfies PlaceUpdateConflictReason);
  assert.equal(orchestratorCalls.length, 0);
  assert.equal(lineageUpdateCalls.length, 0);
}

async function testUpdateConflictTargetIdMissing() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, placeFindUniqueCalls, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture({ targetId: "" }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.conflictReason, "TARGET_ID_MISSING" satisfies PlaceUpdateConflictReason);
  assert.equal(orchestratorCalls.length, 0);
  assert.equal(placeFindUniqueCalls.length, 0, "no targetId means there is nothing to look up");
  assert.equal(lineageUpdateCalls.length, 0);
}

/** "missing target for existing lineage" — lineage claims a targetId, but the Place row itself is gone. */
async function testUpdateConflictTargetRowMissing() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture(),
    targetPlace: null,
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.conflictReason, "TARGET_ROW_MISSING" satisfies PlaceUpdateConflictReason);
  assert.equal(orchestratorCalls.length, 0);
  assert.equal(lineageUpdateCalls.length, 0);
}

/**
 * The exact real-world shape of Place 437: an active lineage with a real
 * targetId, but `lastImportedAt=null` — this is the regression test for
 * "Place 437 must classify as UPDATE_CONFLICT, never auto-updated."
 */
async function testUpdateConflictLastImportedAtNullMatchesPlace437() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-437" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture({ targetId: "place-437", lastImportedAt: null }),
    targetPlace: placeFixture({ id: "place-437" }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(
    inputFixture({
      operation: updateOperationFixture(),
      record: recordFixture({ sourceHash: "hash-current" }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.conflictReason, "LAST_IMPORTED_AT_UNKNOWN" satisfies PlaceUpdateConflictReason);
  assert.equal(result.conflictDetails?.targetId, "place-437");
  assert.equal(orchestratorCalls.length, 0, "Place 437 must never be auto-updated");
  assert.equal(lineageUpdateCalls.length, 0);
  assert.equal((recordUpdateCalls[0] as { data: Record<string, unknown> }).data.status, "QUARANTINED");
}

/**
 * Opening hours ride along inside the same Place UPDATE operation as every
 * other field — this proves candidate.openingHours data present on a
 * Place-437-shaped conflict still never reaches the orchestrator/writer.
 * No separate opening-hours-specific classification exists or is needed.
 */
async function testUpdateConflictWithOpeningHoursCandidateStillNeverCallsWriter() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-437" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture({ targetId: "place-437", lastImportedAt: null }),
    targetPlace: placeFixture({ id: "place-437" }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(
    inputFixture({
      operation: updateOperationFixture(),
      candidate: candidateFixture({
        openingHours: {
          mode: "WEEKLY",
          timezone: "Europe/Minsk",
          rules: [{ dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "09:00", endTime: "18:00" }] }],
        },
      }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.conflictReason, "LAST_IMPORTED_AT_UNKNOWN" satisfies PlaceUpdateConflictReason);
  assert.equal(orchestratorCalls.length, 0, "an opening-hours change must not bypass UPDATE_CONFLICT");
  assert.equal(lineageUpdateCalls.length, 0);
}

async function testUpdateConflictTargetModifiedAfterImport() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const importedAt = new Date("2026-07-07T17:07:59.179Z");
  const manuallyEditedAt = new Date("2026-07-07T20:34:25.053Z"); // after importedAt — a manual edit
  const { prisma, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture({ lastImportedAt: importedAt }),
    targetPlace: placeFixture({ updatedAt: manuallyEditedAt }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.conflictReason, "TARGET_MODIFIED_AFTER_IMPORT" satisfies PlaceUpdateConflictReason);
  assert.equal(orchestratorCalls.length, 0);
  assert.equal(lineageUpdateCalls.length, 0);
}

async function testUpdateSafeWhenTargetUpdatedAtExactlyEqualsLastImportedAt() {
  // Strict `>` comparison, not `>=` — equal timestamps (the common case
  // right after a CREATE, before any manual edit) must classify as safe,
  // not conflict.
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const t0 = new Date("2026-01-01T00:00:00.000Z");
  const { prisma } = createFakePrisma({
    existingLineage: lineageFixture({ lastImportedAt: t0 }),
    targetPlace: placeFixture({ updatedAt: t0 }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));
  assert.equal(result.ok, true);
}

async function testUpdateWriterFailureNotMarkedSuccessAndLeavesLineageUntouched() {
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    reasonCode: "PLACE_CREATE_FAILED",
    error: new Error("db unavailable"),
  });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls, lineageUpdateCalls } = createFakePrisma({
    existingLineage: lineageFixture(),
    targetPlace: placeFixture(),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(lineageUpdateCalls.length, 0, "a failed writer call must never advance lineage");
  assert.equal((recordUpdateCalls[0] as { data: Record<string, unknown> }).data.status, "FAILED");
}

async function testRealTargetIdFlowsEndToEndOnSafeUpdate() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "real-place-cuid-abc123" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma({
    existingLineage: lineageFixture({ targetId: "real-place-cuid-abc123" }),
    targetPlace: placeFixture({ id: "real-place-cuid-abc123" }),
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, true);
  assert.equal(result.placeId, "real-place-cuid-abc123", "the real targetId must flow through end-to-end, never a placeholder");
}

// ---------------------------------------------------------------------------
// Media sync orchestration — when the (optional) mediaSyncer is invoked.
// ---------------------------------------------------------------------------

async function testCreateCallsMediaSyncerWithNewPlaceId() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-new-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma();
  const { syncer: mediaSyncer, calls: mediaCalls } = createFakeMediaSyncer();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(mediaCalls.length, 1, "CREATE must trigger media sync once the target Place id exists");
  const call = mediaCalls[0] as { placeId: string; uploadedByUserId: string; sourceRecordKey: string };
  assert.equal(call.placeId, "place-new-1");
  assert.equal(call.uploadedByUserId, "user-1", "context.createdByUserId flows through as the media owner");
  assert.equal(call.sourceRecordKey, "wordpress-db:places:301");
}

async function testUpdateSafeCallsMediaSyncer() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma({ existingLineage: lineageFixture(), targetPlace: placeFixture() });
  const { syncer: mediaSyncer, calls: mediaCalls } = createFakeMediaSyncer();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, true);
  assert.equal(mediaCalls.length, 1, "a safe UPDATE must also trigger media reconciliation");
}

async function testUpdateConflictNeverCallsMediaSyncer() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma({ existingLineage: null });
  const { syncer: mediaSyncer, calls: mediaCalls } = createFakeMediaSyncer();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  const result = await runner.execute(inputFixture({ operation: updateOperationFixture() }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "BLOCKED");
  assert.equal(mediaCalls.length, 0, "a conflicted UPDATE must never reach media sync — the orchestrator itself never runs");
}

async function testOrchestratorFailureNeverCallsMediaSyncer() {
  const { orchestrator } = createFakeOrchestrator({ ok: false, reasonCode: "PLACE_CREATE_FAILED", error: new Error("boom") });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma();
  const { syncer: mediaSyncer, calls: mediaCalls } = createFakeMediaSyncer();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  await runner.execute(inputFixture());

  assert.equal(mediaCalls.length, 0);
}

async function testMediaSyncerThrowingIsDemotedToWarningRecordStillLinked() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const { syncer: mediaSyncer } = createFakeMediaSyncer({ throwError: new Error("media pipeline exploded") });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true, "an unexpected media sync failure must never fail the Place commit");
  assert.equal(result.status, "LINKED");
  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "LINKED");
  const summary = updateCall.data.validationSummary as Array<{ code: string; details?: { error?: string } }>;
  assert.ok(summary.some((w) => w.code === "PLACE_MEDIA_IMPORT_SKIPPED"));
  assert.equal(summary.find((w) => w.code === "PLACE_MEDIA_IMPORT_SKIPPED")?.details?.error, "media pipeline exploded");
}

async function testMediaWarningsMergedIntoValidationSummary() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const { syncer: mediaSyncer } = createFakeMediaSyncer({
    result: { warnings: [{ code: "PLACE_MEDIA_IMPORTED", message: "imported", severity: "INFO" }], imported: 1 },
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  await runner.execute(inputFixture());

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  const summary = updateCall.data.validationSummary as Array<{ code: string }>;
  assert.ok(summary.some((w) => w.code === "PLACE_MEDIA_IMPORTED"));
}

/**
 * Regression test for a review finding (PR #48, chatgpt-codex-connector):
 * two different attachments failing with the same code+message (a common
 * PlaceMediaSyncer shape — every missing attachment gets the exact same
 * generic message) must never collapse into one warning just because their
 * `details.attachmentId` differs.
 */
async function testWarningsWithSameCodeAndMessageButDifferentDetailsAreNeverCollapsed() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const { syncer: mediaSyncer } = createFakeMediaSyncer({
    result: {
      warnings: [
        { code: "PLACE_MEDIA_SOURCE_MISSING", message: "WordPress attachment row was not found.", severity: "WARNING", details: { attachmentId: 11 } },
        { code: "PLACE_MEDIA_SOURCE_MISSING", message: "WordPress attachment row was not found.", severity: "WARNING", details: { attachmentId: 12 } },
      ],
      skipped: 2,
    },
  });
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  await runner.execute(inputFixture());

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  const summary = updateCall.data.validationSummary as Array<{ code: string; details?: { attachmentId?: number } }>;
  const attachmentIds = summary.filter((w) => w.code === "PLACE_MEDIA_SOURCE_MISSING").map((w) => w.details?.attachmentId);
  assert.deepEqual(attachmentIds.sort(), [11, 12], "both attachments must be preserved, not deduped away");
}

async function testNoMediaWarningsLeavesValidationSummaryUntouched() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const { syncer: mediaSyncer } = createFakeMediaSyncer();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma, mediaSyncer });

  await runner.execute(inputFixture());

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.ok(!("validationSummary" in updateCall.data), "no media warnings means validationSummary is never touched");
}

async function testNoMediaSyncerConfiguredCommitStillSucceeds() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, placeId: "place-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma();
  const runner = new PlaceCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true, "mediaSyncer is optional — its absence must never affect the commit");
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

  await testUpdateSafeCallsWriterAndAdvancesLastImportedAt();
  await testSharedClassifierUpdateSafeContract();
  await testUpdateConflictLineageMissingNeverCallsWriter();
  await testUpdateConflictLineageMismatchNeverTrustsUnfilteredFake();
  await testUpdateConflictTargetIdMissing();
  await testUpdateConflictTargetRowMissing();
  await testUpdateConflictLastImportedAtNullMatchesPlace437();
  await testUpdateConflictWithOpeningHoursCandidateStillNeverCallsWriter();
  await testUpdateConflictTargetModifiedAfterImport();
  await testUpdateSafeWhenTargetUpdatedAtExactlyEqualsLastImportedAt();
  await testUpdateWriterFailureNotMarkedSuccessAndLeavesLineageUntouched();
  await testRealTargetIdFlowsEndToEndOnSafeUpdate();

  await testCreateCallsMediaSyncerWithNewPlaceId();
  await testUpdateSafeCallsMediaSyncer();
  await testUpdateConflictNeverCallsMediaSyncer();
  await testOrchestratorFailureNeverCallsMediaSyncer();
  await testMediaSyncerThrowingIsDemotedToWarningRecordStillLinked();
  await testMediaWarningsMergedIntoValidationSummary();
  await testWarningsWithSameCodeAndMessageButDifferentDetailsAreNeverCollapsed();
  await testNoMediaWarningsLeavesValidationSummaryUntouched();
  await testNoMediaSyncerConfiguredCommitStillSucceeds();
}

main()
  .then(() => {
    console.log("PlaceCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("PlaceCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });
