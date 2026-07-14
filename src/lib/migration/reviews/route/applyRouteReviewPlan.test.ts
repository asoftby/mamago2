import assert from "node:assert/strict";

import { applyRouteReviewPlan, type ApplyRouteReviewPrismaClient } from "./applyRouteReviewPlan";
import type { RouteReviewApplyPlan } from "./routeEditorialReview";

function planFixture(overrides: Partial<RouteReviewApplyPlan["routes"][number]> = {}): RouteReviewApplyPlan {
  return {
    generatedAt: "2026-07-13T00:00:00.000Z",
    expectedRouteCount: 14,
    actualRouteCount: 1,
    decisionCounts: {
      READY: 1,
      NEEDS_COPY_REVIEW: 0,
      NEEDS_MEDIA_REVIEW: 0,
      NEEDS_CITY: 0,
      BLOCKED: 0,
    },
    globalBlockers: [],
    routes: [
      {
        sourceRecordKey: "wordpress-db:routes:701",
        routeId: "route-1",
        decision: "READY",
        proposed: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isEditorial: true,
          authorId: null,
        },
        stopNoteChanges: [
          {
            routeStopId: "stop-1",
            order: 1,
            before: "Long note before",
            after: "Short note after",
            reason: "Shortened.",
          },
        ],
        blockers: [],
        warnings: [],
        ...overrides,
      },
    ],
  };
}

function createFakePrisma(options: {
  routeStatus?: string;
  routeVisibility?: string;
  routeAuthorId?: string | null;
  stopNote?: string;
} = {}) {
  const calls: string[] = [];
  const routeBefore = {
    id: "route-1",
    status: options.routeStatus ?? "DRAFT",
    visibility: options.routeVisibility ?? "PRIVATE",
    authorId: options.routeAuthorId ?? null,
  };
  const stopBefore = {
    id: "stop-1",
    note: options.stopNote ?? "Long note before",
  };

  const tx = {
    route: {
      findUnique: async () => {
        calls.push("tx.route.findUnique");
        return routeBefore;
      },
      update: async () => {
        calls.push("tx.route.update");
        return routeBefore;
      },
    },
    routeStop: {
      findMany: async () => {
        calls.push("tx.routeStop.findMany");
        return [stopBefore];
      },
      update: async () => {
        calls.push("tx.routeStop.update");
        return stopBefore;
      },
    },
  };

  const prisma: ApplyRouteReviewPrismaClient = {
    route: {
      findUnique: async () => {
        calls.push("route.findUnique");
        return routeBefore;
      },
      update: async () => {
        calls.push("route.update");
        return routeBefore;
      },
    } as unknown as ApplyRouteReviewPrismaClient["route"],
    routeStop: {
      findMany: async () => {
        calls.push("routeStop.findMany");
        return [stopBefore];
      },
      update: async () => {
        calls.push("routeStop.update");
        return stopBefore;
      },
    } as unknown as ApplyRouteReviewPrismaClient["routeStop"],
    $transaction: (async (fn: (txClient: typeof tx) => Promise<unknown>) => {
      calls.push("$transaction");
      return fn(tx);
    }) as unknown as ApplyRouteReviewPrismaClient["$transaction"],
  };

  return { prisma, calls };
}

async function testDryRunDoesNotWrite() {
  const { prisma, calls } = createFakePrisma();
  const result = await applyRouteReviewPlan(prisma, planFixture(), { apply: false });

  assert.equal(result.routes[0].status, "DRY_RUN");
  assert.ok(result.routes[0].changes.some((change) => change.includes("Route.status")));
  assert.deepEqual(calls, ["route.findUnique", "routeStop.findMany"]);
}

async function testApplyRequiresReadyDecision() {
  const { prisma, calls } = createFakePrisma();
  const result = await applyRouteReviewPlan(prisma, planFixture({ decision: "BLOCKED", blockers: ["NOPE"] }), {
    apply: true,
  });

  assert.equal(result.routes[0].status, "SKIPPED");
  assert.equal(result.routes[0].reason, "DECISION_BLOCKED");
  assert.deepEqual(calls, []);
}

async function testBeforeValueMismatchSkips() {
  const { prisma, calls } = createFakePrisma({ stopNote: "Changed elsewhere" });
  const result = await applyRouteReviewPlan(prisma, planFixture(), { apply: true });

  assert.equal(result.routes[0].status, "SKIPPED");
  assert.equal(result.routes[0].reason, "ROUTE_STOP_NOTE_CHANGED:stop-1");
  assert.deepEqual(calls, ["route.findUnique", "routeStop.findMany"]);
}

async function testApplyWritesRouteAndStopInsideTransaction() {
  const { prisma, calls } = createFakePrisma();
  const result = await applyRouteReviewPlan(prisma, planFixture(), { apply: true });

  assert.equal(result.routes[0].status, "APPLIED");
  assert.deepEqual(calls, [
    "route.findUnique",
    "routeStop.findMany",
    "$transaction",
    "tx.route.findUnique",
    "tx.routeStop.findMany",
    "tx.routeStop.update",
    "tx.route.update",
  ]);
}

async function testRepeatApplyIsIdempotentlySkippedWhenAlreadyPublished() {
  const { prisma } = createFakePrisma({ routeStatus: "PUBLISHED", routeVisibility: "PUBLIC" });
  const result = await applyRouteReviewPlan(prisma, planFixture(), { apply: true });

  assert.equal(result.routes[0].status, "SKIPPED");
  assert.equal(result.routes[0].reason, "ROUTE_STATUS_CHANGED:PUBLISHED");
}

async function testBlockedRouteIsNotPublished() {
  const { prisma, calls } = createFakePrisma();
  const result = await applyRouteReviewPlan(prisma, planFixture({ decision: "NEEDS_CITY" }), { apply: true });

  assert.equal(result.routes[0].status, "SKIPPED");
  assert.equal(result.routes[0].reason, "DECISION_NEEDS_CITY");
  assert.deepEqual(calls, []);
}

async function testAuthorIdMustRemainNull() {
  const { prisma } = createFakePrisma({ routeAuthorId: "user-1" });
  const result = await applyRouteReviewPlan(prisma, planFixture(), { apply: true });

  assert.equal(result.routes[0].status, "SKIPPED");
  assert.equal(result.routes[0].reason, "ROUTE_AUTHOR_CHANGED");
}

async function testTargetedSourceRecordKeyLeavesUnrelatedRoutesAlone() {
  const { prisma, calls } = createFakePrisma();
  const result = await applyRouteReviewPlan(prisma, planFixture(), {
    apply: true,
    sourceRecordKey: "wordpress-db:routes:999",
  });

  assert.equal(result.routes[0].status, "FAILED");
  assert.equal(result.routes[0].reason, "SOURCE_RECORD_KEY_NOT_IN_PLAN");
  assert.deepEqual(calls, []);
}

async function main() {
  await testDryRunDoesNotWrite();
  await testApplyRequiresReadyDecision();
  await testBeforeValueMismatchSkips();
  await testApplyWritesRouteAndStopInsideTransaction();
  await testRepeatApplyIsIdempotentlySkippedWhenAlreadyPublished();
  await testBlockedRouteIsNotPublished();
  await testAuthorIdMustRemainNull();
  await testTargetedSourceRecordKeyLeavesUnrelatedRoutesAlone();
}

main().then(() => console.log("applyRouteReviewPlan tests: OK"));
