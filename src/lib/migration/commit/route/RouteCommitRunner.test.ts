import assert from "node:assert/strict";

import type { MigrationLineage, MigrationRecord } from "@prisma/client";

import { RouteCommitRunner } from "./RouteCommitRunner";
import type {
  MigrationLineageWriterLike,
  RouteCommitOrchestratorLike,
  RouteCommitRunnerPrismaClient,
} from "./RouteCommitRunner";
import type { ExecuteRouteCommitResult } from "./RouteCommitOrchestrator";
import type { CreateLineageResult } from "../../lineage/types";
import type { CommitOperation } from "../types";
import type { NormalizedRouteCandidate, RouteCommitContext } from "./buildRouteCreateDraft";

function operationFixture(overrides: Partial<CommitOperation> = {}): CommitOperation {
  return {
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:routes:701",
    targetType: "ROUTE",
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
    sourceEntityType: "wordpress-db:routes",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:routes:701",
    sourceRecordKey: "wordpress-db:routes:701",
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: "hash-a",
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: "ROUTE",
    planAction: "CREATE",
    planSummary: { title: "Family Route", slug: "family-route" },
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

function candidateFixture(): NormalizedRouteCandidate {
  return {
    title: "Family Route",
    slug: "family-route",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    stops: [{ index: 1, title: "First", description: "First note", imageAttachmentIds: [], placeId: null }],
    locationRaw: null,
    location: null,
    media: { featuredAttachmentId: null },
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
  };
}

function contextFixture(overrides: Partial<RouteCommitContext> = {}): RouteCommitContext {
  return { cityId: "city-1", ...overrides };
}

function createFakeOrchestrator(result: ExecuteRouteCommitResult) {
  const calls: unknown[] = [];
  const orchestrator: RouteCommitOrchestratorLike = {
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
      if (options.throwError) throw options.throwError;
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

function createFakePrisma(options: { existingLineage?: MigrationLineage | null } = {}) {
  const recordUpdateCalls: unknown[] = [];
  const lineageFindCalls: unknown[] = [];
  const lineageUpdateCalls: unknown[] = [];
  const prisma: RouteCommitRunnerPrismaClient = {
    migrationRecord: {
      update: (async (args: unknown) => {
        recordUpdateCalls.push(args);
        return recordFixture();
      }) as unknown as RouteCommitRunnerPrismaClient["migrationRecord"]["update"],
    },
    migrationLineage: {
      findFirst: (async (args: unknown) => {
        lineageFindCalls.push(args);
        return options.existingLineage ?? null;
      }) as unknown as RouteCommitRunnerPrismaClient["migrationLineage"]["findFirst"],
      update: (async (args: unknown) => {
        lineageUpdateCalls.push(args);
        return {
          id: "lineage-1",
          sourceRecordKey: "wordpress-db:routes:701",
          targetType: "ROUTE",
          targetId: "route-1",
        } as unknown as MigrationLineage;
      }) as unknown as RouteCommitRunnerPrismaClient["migrationLineage"]["update"],
    },
  };
  return { prisma, recordUpdateCalls, lineageFindCalls, lineageUpdateCalls };
}

async function testHappyPathCreatesLineageAndMarksLinked() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, routeId: "route-1", warnings: [] });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new RouteCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute({
    operation: operationFixture(),
    record: recordFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.routeId, "route-1");
  assert.equal(result.lineageId, "lineage-1");
  assert.equal((lineageCalls[0] as { targetType: string }).targetType, "ROUTE");
  assert.deepEqual((recordUpdateCalls[0] as { data: unknown }).data, {
    status: "LINKED",
    lastErrorCode: null,
    lastErrorMessage: null,
  });
}

async function testWarningsAreMergedIntoValidationSummary() {
  const warning = {
    code: "ROUTE_CITY_UNRESOLVED",
    message: "Route cityId was not provided.",
    severity: "WARNING" as const,
    sourceRecordKey: "wordpress-db:routes:701",
  };
  const { orchestrator } = createFakeOrchestrator({ ok: true, routeId: "route-1", warnings: [warning] });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma();
  const runner = new RouteCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute({
    operation: operationFixture(),
    record: recordFixture(),
    candidate: candidateFixture(),
    context: contextFixture({ cityId: null }),
  });

  const updateCall = recordUpdateCalls[0] as { data: Record<string, unknown> };
  assert.deepEqual(updateCall.data.validationSummary, [warning]);
}

async function testUpdateWithActiveLineageIsIdempotentPath() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, routeId: "route-1", warnings: [] });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const existingLineage = {
    id: "lineage-9",
    sourceRecordKey: "wordpress-db:routes:701",
    targetType: "ROUTE",
    targetId: "route-1",
  } as unknown as MigrationLineage;
  const { prisma, lineageFindCalls, lineageUpdateCalls } = createFakePrisma({ existingLineage });
  const runner = new RouteCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute({
    operation: operationFixture({ action: "UPDATE" }),
    record: recordFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
  });

  assert.equal(lineageFindCalls.length, 1);
  assert.equal(lineageCalls.length, 0, "UPDATE must update existing lineage, not create a second lineage row");
  assert.equal(lineageUpdateCalls.length, 1);
  assert.equal((orchestratorCalls[0] as { targetRouteId?: string | null }).targetRouteId, "route-1");
}

async function testUpdateWithoutLineageFailsBeforeOrchestrator() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, routeId: "route-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, recordUpdateCalls } = createFakePrisma({ existingLineage: null });
  const runner = new RouteCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute({
    operation: operationFixture({ action: "UPDATE" }),
    record: recordFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "ROUTE_UPDATE_TARGET_MISSING");
  assert.equal(orchestratorCalls.length, 0);
  assert.equal((recordUpdateCalls[0] as { data: Record<string, unknown> }).data.status, "FAILED");
}

async function main() {
  await testHappyPathCreatesLineageAndMarksLinked();
  await testWarningsAreMergedIntoValidationSummary();
  await testUpdateWithActiveLineageIsIdempotentPath();
  await testUpdateWithoutLineageFailsBeforeOrchestrator();
}

main()
  .then(() => {
    console.log("RouteCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("RouteCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });
