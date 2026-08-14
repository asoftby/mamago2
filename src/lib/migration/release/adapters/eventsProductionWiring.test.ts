import assert from "node:assert/strict";
import { createEventsPhasePreflight, createEventsWriter, type EventsWriterPrismaClient, type RawEventSourceRepository } from "./eventsProductionWiring";
import type { NormalizedEventCandidate } from "../../adapters/wordpress-db/normalizeEvent";
import type { EventCreateTransactionClient } from "../../commit/event/runAtomicEventCreate";

const KEY = "wordpress-db:events:1";
const candidate = { sourceRecordKey: KEY, domainHash: "hash", ownerUserSourceRecordKey: "wordpress-db:user:7", placeSourceRecordKey: null };
function normalized(): NormalizedEventCandidate { return { title: "Event", slug: "event", content: "Body", excerpt: "Excerpt", status: "publish", publishedAt: "2026-01-01", modifiedAt: "2026-01-01", eventDatesRaw: ["2026-09-12 13:00:00"], scheduleDraft: { mode: "ONE_TIME", dates: ["2026-09-12"], startTime: "13:00" }, venueNameRaw: null, locationRaw: null, addressEventPlaceRaw: null, cityRaw: null, priceRaw: null, ticketUrlRaw: null, externalEventId: null, externalLastUpdatedRaw: null, trailerUrlRaw: null, seo: { title: null, focusKeyword: null }, sourceTerms: [], rawMeta: {} }; }
const raw: RawEventSourceRepository = { load: () => ({ normalized: normalized(), ownerUserSourceRecordKey: "wordpress-db:user:7", placeSourceRecordKey: null }) };

function transactionalFake(failAt?: "schedule" | "lineage") {
  const committed = { activities: [] as string[], sessions: [] as string[], lineages: [] as string[] };
  const prisma = {
    activity: { findMany: async () => [], findUnique: async () => null },
    user: { findUnique: async () => ({ id: "user-7" }) }, place: { findUnique: async () => null },
    migrationLineage: { findMany: async (args: { where?: { targetType?: string; sourceRecordKey?: string } }) => args.where?.sourceRecordKey === "wordpress-db:user:7" ? [{ targetId: "user-7" }] : [] },
    $transaction: async (fn: (tx: EventCreateTransactionClient) => Promise<unknown>) => {
      const staged = { activities: [] as string[], sessions: [] as string[], lineages: [] as string[] };
      const tx = {
        activity: {
          create: async () => { staged.activities.push("activity-1"); return { id: "activity-1" }; },
          update: async () => ({ id: "activity-1" }),
        },
        activitySession: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async () => { if (failAt === "schedule") throw new Error("SCHEDULE_FAILED"); staged.sessions.push("session-1"); return { count: 1 }; },
          findFirst: async () => ({ startsAt: new Date("2026-09-12T13:00:00Z") }), findMany: async () => [],
        },
        eventVenue: { upsert: async () => ({ id: "venue-1" }) },
        migrationLineage: {
          updateMany: async () => ({ count: 0 }), findUnique: async () => null, findUniqueOrThrow: async () => ({ id: "lineage-1" }),
          create: async () => { if (failAt === "lineage") throw new Error("LINEAGE_FAILED"); staged.lineages.push("lineage-1"); return { id: "lineage-1" }; },
        },
      } as unknown as EventCreateTransactionClient;
      const result = await fn(tx);
      committed.activities.push(...staged.activities); committed.sessions.push(...staged.sessions); committed.lineages.push(...staged.lineages);
      return result;
    },
  } as unknown as EventsWriterPrismaClient;
  return { prisma, committed };
}

async function main(): Promise<void> {
  const clean = await createEventsPhasePreflight({ activity: { findMany: async () => [], findUnique: async () => null }, migrationLineage: { findMany: async () => [] }, user: { findUnique: async () => null }, place: { findUnique: async () => null } } as never)();
  assert.equal(clean.ok, true);
  const orphan = await createEventsPhasePreflight({ activity: { findMany: async () => [{ id: "activity-safe-id" }], findUnique: async () => null }, migrationLineage: { findMany: async () => [] }, user: { findUnique: async () => null }, place: { findUnique: async () => null } } as never)();
  assert.equal(orphan.blocker, "EVENTS_UNCLASSIFIABLE_TARGET_STATE");
  const duplicateTarget = await createEventsPhasePreflight({ activity: { findMany: async () => [{ id: "a1" }], findUnique: async () => null }, migrationLineage: { findMany: async () => [{ sourceRecordKey: "e1", targetId: "a1" }, { sourceRecordKey: "e2", targetId: "a1" }] }, user: { findUnique: async () => null }, place: { findUnique: async () => null } } as never)();
  assert.equal(duplicateTarget.blocker, "DUPLICATE_LINEAGE_TARGET");
  const duplicateSource = await createEventsPhasePreflight({ activity: { findMany: async () => [{ id: "a1" }, { id: "a2" }], findUnique: async () => null }, migrationLineage: { findMany: async () => [{ sourceRecordKey: "e1", targetId: "a1" }, { sourceRecordKey: "e1", targetId: "a2" }] }, user: { findUnique: async () => null }, place: { findUnique: async () => null } } as never)();
  assert.equal(duplicateSource.blocker, "DUPLICATE_LINEAGE");
  const missingTarget = await createEventsPhasePreflight({ activity: { findMany: async () => [], findUnique: async () => null }, migrationLineage: { findMany: async () => [{ sourceRecordKey: "e1", targetId: "missing-safe-id" }] }, user: { findUnique: async () => null }, place: { findUnique: async () => null } } as never)();
  assert.equal(missingTarget.blocker, "LINEAGE_WITHOUT_TARGET");

  const happy = transactionalFake(); await createEventsWriter(happy.prisma, raw, "source-1")(candidate);
  assert.deepEqual(happy.committed, { activities: ["activity-1"], sessions: ["session-1"], lineages: ["lineage-1"] });
  const lineageFailure = transactionalFake("lineage"); await assert.rejects(() => createEventsWriter(lineageFailure.prisma, raw, "source-1")(candidate), /LINEAGE_FAILED/); assert.deepEqual(lineageFailure.committed, { activities: [], sessions: [], lineages: [] });
  const scheduleFailure = transactionalFake("schedule"); await assert.rejects(() => createEventsWriter(scheduleFailure.prisma, raw, "source-1")(candidate), /SCHEDULE_FAILED/); assert.deepEqual(scheduleFailure.committed, { activities: [], sessions: [], lineages: [] });
  console.log("Phoenix Events production wiring tests: PASS");
}
void main();
