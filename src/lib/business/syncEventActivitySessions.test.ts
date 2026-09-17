/**
 * Tests for replaceActivitySessionsFromScheduleJson().
 *
 * The shared writer must still refuse to touch imported sessions (`source`
 * non-null). After an explicit manual takeover the same rows become
 * source:null; in that state a normal wizard resync is allowed and ticket
 * metadata is preserved only for unchanged occurrence instants.
 */
import assert from "node:assert/strict";
import { replaceActivitySessionsFromScheduleJson } from "./syncEventActivitySessions";

const SIMPLE_SCHEDULE = {
  scheduleItems: [{ date: "2026-10-01", startTime: "10:00" }],
};

type FakeSession = {
  source: string | null;
  startsAt?: Date;
  buyUrl?: string | null;
  priceMinCents?: number | null;
  priceMaxCents?: number | null;
  isSaleOpen?: boolean | null;
};

function makeFakePrisma(existingSessions: FakeSession[]) {
  const normalizedSessions = existingSessions.map((session) => ({
    startsAt: session.startsAt ?? new Date("2026-10-01T07:00:00.000Z"),
    source: session.source,
    buyUrl: session.buyUrl ?? null,
    priceMinCents: session.priceMinCents ?? null,
    priceMaxCents: session.priceMaxCents ?? null,
    isSaleOpen: session.isSaleOpen ?? null,
  }));

  const calls = {
    deleteManyCalled: false,
    createManyCalled: false,
    deleteManyWhere: undefined as unknown,
    createManyData: [] as unknown[],
  };
  const prisma = {
    activitySession: {
      findMany: async () => normalizedSessions,
      deleteMany: async (args: { where: unknown }) => {
        calls.deleteManyCalled = true;
        calls.deleteManyWhere = args.where;
        return { count: 0 };
      },
      createMany: async (args: { data: unknown[] }) => {
        calls.createManyCalled = true;
        calls.createManyData = args.data;
        return { count: args.data.length };
      },
    },
  };
  return { prisma, calls };
}

async function testSkipsEntirelyWhenAnyImportedSessionExists() {
  const { prisma, calls } = makeFakePrisma([
    { source: null },
    { source: "abws-performances-event" },
  ]);

  const result = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-imported",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(result, { count: 0, skipped: true });
  assert.equal(calls.deleteManyCalled, false);
  assert.equal(calls.createManyCalled, false);
}

async function testProceedsNormallyWhenNoSessionHasSource() {
  const { prisma, calls } = makeFakePrisma([{ source: null }]);

  const result = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-ordinary",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(result, { count: 1, skipped: false });
  assert.equal(calls.deleteManyCalled, true);
  assert.equal(calls.createManyCalled, true);
}

async function testProceedsNormallyWhenNoSessionsExistYet() {
  const { prisma, calls } = makeFakePrisma([]);

  const result = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-new",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(result, { count: 1, skipped: false });
  assert.equal(calls.deleteManyCalled, true);
  assert.equal(calls.createManyCalled, true);
}

async function testDeleteIsScopedToSourceNull() {
  const { prisma, calls } = makeFakePrisma([{ source: null }]);

  await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-race",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(calls.deleteManyWhere, {
    activityId: "activity-race",
    source: null,
  });
}

async function testPreservesTicketMetadataForUnchangedInstant() {
  const { prisma, calls } = makeFakePrisma([
    {
      source: null,
      startsAt: new Date("2026-10-01T07:00:00.000Z"),
      buyUrl: "https://tickets.example/session-1",
      priceMinCents: 1200,
      priceMaxCents: 1800,
      isSaleOpen: true,
    },
  ]);

  await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-manual",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(calls.createManyData, [
    {
      activityId: "activity-manual",
      startsAt: new Date("2026-10-01T07:00:00.000Z"),
      buyUrl: "https://tickets.example/session-1",
      priceMinCents: 1200,
      priceMaxCents: 1800,
      isSaleOpen: true,
    },
  ]);
}

async function testDoesNotMoveTicketMetadataToChangedInstant() {
  const { prisma, calls } = makeFakePrisma([
    {
      source: null,
      startsAt: new Date("2026-10-01T08:00:00.000Z"),
      buyUrl: "https://tickets.example/old-session",
      priceMinCents: 1200,
      priceMaxCents: 1800,
      isSaleOpen: true,
    },
  ]);

  await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-manual-changed",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(calls.createManyData, [
    {
      activityId: "activity-manual-changed",
      startsAt: new Date("2026-10-01T07:00:00.000Z"),
    },
  ]);
}

async function main() {
  await testSkipsEntirelyWhenAnyImportedSessionExists();
  await testProceedsNormallyWhenNoSessionHasSource();
  await testProceedsNormallyWhenNoSessionsExistYet();
  await testDeleteIsScopedToSourceNull();
  await testPreservesTicketMetadataForUnchangedInstant();
  await testDoesNotMoveTicketMetadataToChangedInstant();
  console.log("syncEventActivitySessions tests: OK");
}

main().catch((error) => {
  console.error("syncEventActivitySessions tests: FAILED", error);
  process.exitCode = 1;
});
