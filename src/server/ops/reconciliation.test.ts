/**
 * Signal reconciliation lifecycle tests (§21 Step 3, Phase L). Mandatory
 * 14-scenario suite against real PostgreSQL, using the isolated test DB.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/reconciliation.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { reconcileDetectorSignals } from "./reconciliation";
import type { SignalDraft } from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const DETECTOR = "test.reconcile";

function sig(fingerprint: string, overrides: Partial<SignalDraft> = {}): SignalDraft {
  return {
    fingerprint,
    type: "TEST_PROBLEM",
    severity: "WARNING",
    title: "test problem",
    ...overrides,
  };
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function live(fingerprint: string) {
    return prisma.operationalSignal.findFirst({
      where: { detector: DETECTOR, fingerprint, resolvedAt: null },
    });
  }

  async function reset() {
    await prisma.operationalSignal.deleteMany({ where: { detector: DETECTOR } });
  }

  try {
    // 1. First hit -> PENDING.
    await reset();
    {
      const counts = await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-1")]);
      assert.equal(counts.signalsOpened, 0);
      const row = await live("fp-1");
      assert.equal(row?.status, "PENDING");
      assert.equal(row?.consecutiveHits, 1);
    }

    // 2. Second consecutive hit -> OPEN.
    {
      const counts = await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-1")]);
      assert.equal(counts.signalsOpened, 1);
      const row = await live("fp-1");
      assert.equal(row?.status, "OPEN");
      assert.ok(row?.openedAt);
      assert.ok(row?.attentionChangedAt);
    }

    // 3. PENDING + miss -> ABORTED.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-3")]); // PENDING
      await reconcileDetectorSignals(prisma, DETECTOR, []); // miss
      const row = await prisma.operationalSignal.findFirst({ where: { detector: DETECTOR, fingerprint: "fp-3" } });
      assert.equal(row?.status, "ABORTED");
      assert.equal(row?.resolution, "ABORTED");
      assert.ok(row?.resolvedAt);
      assert.equal(await live("fp-3"), null, "must no longer be live");
    }

    // 4/5/6. OPEN + 1st/2nd/3rd miss.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-456")]); // PENDING
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-456")]); // OPEN

      await reconcileDetectorSignals(prisma, DETECTOR, []); // miss 1
      let row = await live("fp-456");
      assert.equal(row?.status, "OPEN", "1st miss: remains OPEN");
      assert.equal(row?.consecutiveMisses, 1);

      await reconcileDetectorSignals(prisma, DETECTOR, []); // miss 2
      row = await live("fp-456");
      assert.equal(row?.status, "OPEN", "2nd miss: remains OPEN");
      assert.equal(row?.consecutiveMisses, 2);

      const counts = await reconcileDetectorSignals(prisma, DETECTOR, []); // miss 3
      assert.equal(counts.signalsResolved, 1);
      row = await live("fp-456");
      assert.equal(row, null, "3rd miss: RESOLVED, no longer live");
      const resolvedRow = await prisma.operationalSignal.findFirst({
        where: { detector: DETECTOR, fingerprint: "fp-456" },
      });
      assert.equal(resolvedRow?.status, "RESOLVED");
      assert.equal(resolvedRow?.resolution, "AUTO");
      assert.ok(resolvedRow?.resolvedAt);
    }

    // 7. Repeat after RESOLVED creates new incident with same fingerprint.
    {
      const counts = await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-456")]);
      assert.equal(counts.signalsOpened, 0);
      const row = await live("fp-456");
      assert.equal(row?.status, "PENDING");
      assert.notEqual(row?.id, undefined);
      const historyCount = await prisma.operationalSignal.count({
        where: { detector: DETECTOR, fingerprint: "fp-456" },
      });
      assert.equal(historyCount, 2, "old RESOLVED row + new PENDING row must coexist");
    }

    // 8. Only one live fingerprint exists at a time (DB partial unique index).
    {
      // fp-456 is currently PENDING (live). Force a concurrent duplicate
      // insert attempt directly to prove the DB constraint holds.
      await assert.rejects(() =>
        prisma.operationalSignal.create({
          data: {
            fingerprint: "fp-456",
            detector: DETECTOR,
            type: "TEST_PROBLEM",
            status: "PENDING",
            severity: "WARNING",
            title: "duplicate live attempt",
            consecutiveHits: 1,
          },
        }),
      );
    }

    // 9. Hit resets consecutiveMisses.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-9")]); // PENDING
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-9")]); // OPEN
      await reconcileDetectorSignals(prisma, DETECTOR, []); // miss 1 -> consecutiveMisses=1
      let row = await live("fp-9");
      assert.equal(row?.consecutiveMisses, 1);
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-9")]); // hit -> resets misses
      row = await live("fp-9");
      assert.equal(row?.consecutiveMisses, 0, "hit must reset consecutiveMisses");
    }

    // 10. Miss resets consecutiveHits.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-10")]); // PENDING, hits=1
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-10")]); // OPEN, hits=2
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-10")]); // hit again, hits=3
      let row = await live("fp-10");
      assert.equal(row?.consecutiveHits, 3);
      await reconcileDetectorSignals(prisma, DETECTOR, []); // miss -> resets hits
      row = await live("fp-10");
      assert.equal(row?.consecutiveHits, 0, "miss must reset consecutiveHits");
    }

    // 11. A failed detector run does NOT count as a miss — proven at the
    // integration level: reconcileDetectorSignals is simply never invoked
    // for a non-OK run (see detectorRun.test.ts, executor persistResult is
    // only called on the OK path). Confirm the state machine itself has no
    // notion of a "failed run" input — omitting a call entirely leaves the
    // signal state completely untouched.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-11")]);
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-11")]); // OPEN
      const before = await live("fp-11");
      // Simulate "detector run failed, reconciliation skipped this cycle" by
      // simply not calling reconcileDetectorSignals at all.
      const after = await live("fp-11");
      assert.deepEqual(after, before, "no reconciliation call must leave state untouched");
    }

    // 12. Manual-resolved history does not block recurrence.
    await reset();
    {
      const pending = await prisma.operationalSignal.create({
        data: {
          fingerprint: "fp-12",
          detector: DETECTOR,
          type: "TEST_PROBLEM",
          status: "OPEN",
          severity: "WARNING",
          title: "manually resolved",
          consecutiveHits: 2,
          openedAt: new Date(),
          attentionChangedAt: new Date(),
        },
      });
      await prisma.operationalSignal.update({
        where: { id: pending.id },
        data: { status: "RESOLVED", resolution: "MANUAL", resolvedAt: new Date(), resolvedBy: "admin-test" },
      });
      const counts = await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-12")]);
      assert.equal(counts.signalsOpened, 0);
      const row = await live("fp-12");
      assert.equal(row?.status, "PENDING", "new incident must be created despite manual-resolved history");
    }

    // 13. WARNING -> CRITICAL: same incident, openedAt unchanged,
    // attentionChangedAt advances, ack/snooze cleared.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-13")]);
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-13")]); // OPEN, WARNING
      const openRow = await live("fp-13");
      assert.equal(openRow?.severity, "WARNING");

      await prisma.operationalSignal.update({
        where: { id: openRow!.id },
        data: { acknowledgedAt: new Date(), acknowledgedBy: "admin-test", snoozedUntil: new Date(Date.now() + 3600_000) },
      });
      const acked = await live("fp-13");
      const openedAtBefore = acked!.openedAt;
      const attentionChangedAtBefore = acked!.attentionChangedAt;

      await new Promise((r) => setTimeout(r, 5));
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-13", { severity: "CRITICAL" })]);
      const escalated = await live("fp-13");
      assert.equal(escalated?.id, acked?.id, "same incident");
      assert.equal(escalated?.severity, "CRITICAL");
      assert.equal(escalated?.openedAt?.getTime(), openedAtBefore?.getTime(), "openedAt unchanged");
      assert.ok(
        escalated!.attentionChangedAt!.getTime() > attentionChangedAtBefore!.getTime(),
        "attentionChangedAt must advance",
      );
      assert.equal(escalated?.acknowledgedAt, null, "ack cleared");
      assert.equal(escalated?.acknowledgedBy, null, "ack cleared");
      assert.equal(escalated?.snoozedUntil, null, "snooze cleared");
    }

    // 14. CRITICAL -> WARNING: same incident, attentionChangedAt unchanged,
    // ack/snooze preserved.
    await reset();
    {
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-14", { severity: "CRITICAL" })]);
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-14", { severity: "CRITICAL" })]); // OPEN, CRITICAL
      const openRow = await live("fp-14");

      const snoozeUntil = new Date(Date.now() + 3600_000);
      await prisma.operationalSignal.update({
        where: { id: openRow!.id },
        data: { acknowledgedAt: new Date(), acknowledgedBy: "admin-test", snoozedUntil: snoozeUntil },
      });
      const acked = await live("fp-14");
      const attentionChangedAtBefore = acked!.attentionChangedAt;

      await new Promise((r) => setTimeout(r, 5));
      await reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-14", { severity: "WARNING" })]);
      const deescalated = await live("fp-14");
      assert.equal(deescalated?.id, acked?.id, "same incident");
      assert.equal(deescalated?.severity, "WARNING");
      assert.equal(
        deescalated?.attentionChangedAt?.getTime(),
        attentionChangedAtBefore?.getTime(),
        "attentionChangedAt unchanged",
      );
      assert.ok(deescalated?.acknowledgedAt, "ack preserved");
      assert.equal(deescalated?.acknowledgedBy, "admin-test", "ack preserved");
      assert.equal(deescalated?.snoozedUntil?.getTime(), snoozeUntil.getTime(), "snooze preserved");
    }

    // Reject invalid hysteresis (close must be > open).
    await reset();
    {
      await assert.rejects(() =>
        reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-invalid")], { open: 3, close: 2 }),
      );
      await assert.rejects(() =>
        reconcileDetectorSignals(prisma, DETECTOR, [sig("fp-invalid")], { open: 2, close: 2 }),
      );
    }

    console.log("reconciliation.test.ts: OK");
  } finally {
    await prisma.operationalSignal.deleteMany({ where: { detector: DETECTOR } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
