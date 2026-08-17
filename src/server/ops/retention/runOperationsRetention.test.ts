/**
 * runOperationsRetention() boundary/matrix tests (§21 Step 6, Phase M).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/retention/runOperationsRetention.test.ts
 *
 * Uses runOperationsRetentionAt(prisma, now) with a single, fully
 * controlled `now` shared by both the fixtures and the cutoff
 * computation — not a separately-observed wall-clock reading. This makes
 * "exactly N days old" a bit-exact, deterministic assertion rather than
 * an approximation: fixtures are placed at exactly `now - Nd` (must be
 * kept, strict `<`) and at `now - Nd - 1ms` (must be deleted, the
 * minimal possible amount past the boundary). Production
 * `runOperationsRetention(prisma)` is exercised separately (test 0) to
 * prove it still sources `now` from a real `clock_timestamp()` call.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getDbNow } from "../dbTime";
import {
  runOperationsRetention,
  runOperationsRetentionAt,
  METRIC_SAMPLE_RETENTION_DAYS,
  DETECTOR_RUN_RETENTION_DAYS,
  RESOLVED_SIGNAL_RETENTION_DAYS,
  ABORTED_SIGNAL_RETENTION_DAYS,
} from "./runOperationsRetention";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const marker = randomUUID().slice(0, 8);

function daysBefore(now: Date, days: number, extraMs = 0): Date {
  return new Date(now.getTime() - days * DAY_MS - extraMs);
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    await prisma.operationalSignal.deleteMany({ where: { detector: `retention-test-${marker}` } });
    await prisma.detectorRun.deleteMany({ where: { detector: `retention-test-${marker}` } });
    await prisma.metricSample.deleteMany({ where: { metric: `retention.test.${marker}` } });

    // 0. Production entrypoint: still sources `now` from a real DB
    // clock_timestamp() call rather than worker wall-clock.
    {
      const beforeCall = await getDbNow(prisma);
      const result = await runOperationsRetention(prisma);
      const afterCall = await getDbNow(prisma);
      assert.ok(
        result.startedAt.getTime() >= beforeCall.getTime() && result.startedAt.getTime() <= afterCall.getTime(),
        "runOperationsRetention must use a real DB-observed instant as startedAt",
      );
    }

    // A single, fully controlled reference instant shared by every
    // fixture below and by the cutoff computation itself.
    const now = new Date("2026-06-15T12:00:00.000Z");

    // ---- MetricSample fixtures ----
    const msFresh = await prisma.metricSample.create({
      data: { metric: `retention.test.${marker}`, dimKey: "fresh", value: 1, collectedAt: daysBefore(now, 1) },
    });
    const msExactly90 = await prisma.metricSample.create({
      data: {
        metric: `retention.test.${marker}`,
        dimKey: "exactly90",
        value: 1,
        collectedAt: daysBefore(now, METRIC_SAMPLE_RETENTION_DAYS),
      },
    });
    const msOneMsOver90 = await prisma.metricSample.create({
      data: {
        metric: `retention.test.${marker}`,
        dimKey: "oneMsOver90",
        value: 1,
        collectedAt: daysBefore(now, METRIC_SAMPLE_RETENTION_DAYS, 1),
      },
    });

    // ---- DetectorRun fixtures ----
    const detectorName = `retention-test-${marker}`;
    const drFresh = await prisma.detectorRun.create({
      data: { detector: detectorName, status: "OK", startedAt: daysBefore(now, 1), finishedAt: daysBefore(now, 1) },
    });
    const drExactly30 = await prisma.detectorRun.create({
      data: {
        detector: detectorName,
        status: "OK",
        startedAt: daysBefore(now, DETECTOR_RUN_RETENTION_DAYS),
        finishedAt: daysBefore(now, DETECTOR_RUN_RETENTION_DAYS),
      },
    });
    const drOneMsOver30 = await prisma.detectorRun.create({
      data: {
        detector: detectorName,
        status: "FAILED",
        startedAt: daysBefore(now, DETECTOR_RUN_RETENTION_DAYS, 1),
        finishedAt: daysBefore(now, DETECTOR_RUN_RETENTION_DAYS, 1),
      },
    });
    // Ancient RUNNING row (finishedAt=null): must NEVER be deleted, even
    // though startedAt is far beyond the retention horizon.
    const drAncientRunning = await prisma.detectorRun.create({
      data: { detector: detectorName, status: "RUNNING", startedAt: daysBefore(now, 100), finishedAt: null },
    });

    // ---- OperationalSignal fixtures ----
    async function makeResolvedSignal(fingerprint: string, resolvedAt: Date) {
      return prisma.operationalSignal.create({
        data: {
          fingerprint,
          detector: detectorName,
          type: "test",
          status: "RESOLVED",
          severity: "WARNING",
          title: "retention test signal",
          firstSeenAt: resolvedAt,
          lastSeenAt: resolvedAt,
          openedAt: resolvedAt,
          attentionChangedAt: resolvedAt,
          resolvedAt,
          resolution: "AUTO",
        },
      });
    }
    async function makeAbortedSignal(fingerprint: string, resolvedAt: Date) {
      return prisma.operationalSignal.create({
        data: {
          fingerprint,
          detector: detectorName,
          type: "test",
          status: "ABORTED",
          severity: "WARNING",
          title: "retention test signal",
          firstSeenAt: resolvedAt,
          lastSeenAt: resolvedAt,
          resolvedAt,
          resolution: "ABORTED",
        },
      });
    }

    const sigResolvedFresh = await makeResolvedSignal(`${marker}-resolved-fresh`, daysBefore(now, 1));
    const sigResolvedExactly180 = await makeResolvedSignal(
      `${marker}-resolved-exactly180`,
      daysBefore(now, RESOLVED_SIGNAL_RETENTION_DAYS),
    );
    const sigResolvedOneMsOver180 = await makeResolvedSignal(
      `${marker}-resolved-oneMsOver180`,
      daysBefore(now, RESOLVED_SIGNAL_RETENTION_DAYS, 1),
    );

    const sigAbortedFresh = await makeAbortedSignal(`${marker}-aborted-fresh`, daysBefore(now, 1));
    const sigAbortedExactly14 = await makeAbortedSignal(
      `${marker}-aborted-exactly14`,
      daysBefore(now, ABORTED_SIGNAL_RETENTION_DAYS),
    );
    const sigAbortedOneMsOver14 = await makeAbortedSignal(
      `${marker}-aborted-oneMsOver14`,
      daysBefore(now, ABORTED_SIGNAL_RETENTION_DAYS, 1),
    );

    // Live signals, old, must NEVER be deleted regardless of age.
    const sigOpenOld = await prisma.operationalSignal.create({
      data: {
        fingerprint: `${marker}-open-old`,
        detector: detectorName,
        type: "test",
        status: "OPEN",
        severity: "CRITICAL",
        title: "retention test signal (open, old)",
        firstSeenAt: daysBefore(now, 400),
        lastSeenAt: daysBefore(now, 1),
        openedAt: daysBefore(now, 400),
        attentionChangedAt: daysBefore(now, 400),
      },
    });
    const sigPendingOld = await prisma.operationalSignal.create({
      data: {
        fingerprint: `${marker}-pending-old`,
        detector: detectorName,
        type: "test",
        status: "PENDING",
        severity: "WARNING",
        title: "retention test signal (pending, old)",
        firstSeenAt: daysBefore(now, 400),
        lastSeenAt: daysBefore(now, 1),
      },
    });

    // ---- Other entities: must remain completely untouched ----
    const otherCountsBefore = {
      snapshots: await prisma.operationsSnapshot.count(),
      releaseEvents: await prisma.releaseEvent.count(),
      viewStates: await prisma.operationsViewState.count(),
      auditLogs: await prisma.auditLog.count(),
      adminAuditLogs: await prisma.adminAuditLog.count(),
    };

    // ---- Run retention against the exact controlled `now` ----
    const result = await runOperationsRetentionAt(prisma, now);

    // Cutoff math sanity: the function must compute cutoffs from exactly
    // the `now` it was given, not a fresh clock reading.
    assert.equal(result.cutoffs.metricSample.getTime(), daysBefore(now, METRIC_SAMPLE_RETENTION_DAYS).getTime());
    assert.equal(result.cutoffs.detectorRun.getTime(), daysBefore(now, DETECTOR_RUN_RETENTION_DAYS).getTime());
    assert.equal(
      result.cutoffs.resolvedSignal.getTime(),
      daysBefore(now, RESOLVED_SIGNAL_RETENTION_DAYS).getTime(),
    );
    assert.equal(result.cutoffs.abortedSignal.getTime(), daysBefore(now, ABORTED_SIGNAL_RETENTION_DAYS).getTime());

    // MetricSample: exactly 90 days old -> KEEP; one ms past -> DELETE.
    assert.ok(await prisma.metricSample.findUnique({ where: { id: msFresh.id } }), "fresh sample must be kept");
    assert.ok(
      await prisma.metricSample.findUnique({ where: { id: msExactly90.id } }),
      "a sample exactly 90 days old (collectedAt === now - 90d) must be kept",
    );
    assert.equal(
      await prisma.metricSample.findUnique({ where: { id: msOneMsOver90.id } }),
      null,
      "a sample one millisecond past the 90d cutoff must be deleted",
    );

    // DetectorRun: exactly 30 days old -> KEEP; one ms past -> DELETE.
    assert.ok(await prisma.detectorRun.findUnique({ where: { id: drFresh.id } }), "fresh run must be kept");
    assert.ok(
      await prisma.detectorRun.findUnique({ where: { id: drExactly30.id } }),
      "a run exactly 30 days old (finishedAt === now - 30d) must be kept",
    );
    assert.equal(
      await prisma.detectorRun.findUnique({ where: { id: drOneMsOver30.id } }),
      null,
      "a run one millisecond past the 30d cutoff must be deleted",
    );
    assert.ok(
      await prisma.detectorRun.findUnique({ where: { id: drAncientRunning.id } }),
      "an ancient RUNNING row (finishedAt=null) must never be deleted",
    );

    // OperationalSignal RESOLVED: exactly 180 days old -> KEEP; one ms past -> DELETE.
    assert.ok(
      await prisma.operationalSignal.findUnique({ where: { id: sigResolvedFresh.id } }),
      "fresh resolved signal must be kept",
    );
    assert.ok(
      await prisma.operationalSignal.findUnique({ where: { id: sigResolvedExactly180.id } }),
      "a resolved signal exactly 180 days old (resolvedAt === now - 180d) must be kept",
    );
    assert.equal(
      await prisma.operationalSignal.findUnique({ where: { id: sigResolvedOneMsOver180.id } }),
      null,
      "a resolved signal one millisecond past the 180d cutoff must be deleted",
    );

    // OperationalSignal ABORTED: exactly 14 days old -> KEEP; one ms past -> DELETE.
    assert.ok(
      await prisma.operationalSignal.findUnique({ where: { id: sigAbortedFresh.id } }),
      "fresh aborted signal must be kept",
    );
    assert.ok(
      await prisma.operationalSignal.findUnique({ where: { id: sigAbortedExactly14.id } }),
      "an aborted signal exactly 14 days old (resolvedAt === now - 14d) must be kept",
    );
    assert.equal(
      await prisma.operationalSignal.findUnique({ where: { id: sigAbortedOneMsOver14.id } }),
      null,
      "an aborted signal one millisecond past the 14d cutoff must be deleted",
    );

    // Live signals: never deleted regardless of age.
    assert.ok(
      await prisma.operationalSignal.findUnique({ where: { id: sigOpenOld.id } }),
      "an old OPEN signal must never be deleted",
    );
    assert.ok(
      await prisma.operationalSignal.findUnique({ where: { id: sigPendingOld.id } }),
      "an old PENDING signal must never be deleted",
    );

    // Other entities untouched.
    const otherCountsAfter = {
      snapshots: await prisma.operationsSnapshot.count(),
      releaseEvents: await prisma.releaseEvent.count(),
      viewStates: await prisma.operationsViewState.count(),
      auditLogs: await prisma.auditLog.count(),
      adminAuditLogs: await prisma.adminAuditLog.count(),
    };
    assert.deepEqual(
      otherCountsAfter,
      otherCountsBefore,
      "OperationsSnapshot/ReleaseEvent/OperationsViewState/AuditLog/AdminAuditLog must be untouched",
    );

    // Result shape sanity.
    assert.equal(result.startedAt.getTime(), now.getTime());
    assert.equal(result.deleted.metricSamples, 1);
    assert.equal(result.deleted.detectorRuns, 1);
    assert.equal(result.deleted.resolvedSignals, 1);
    assert.equal(result.deleted.abortedSignals, 1);

    // Idempotency: nothing newly expired between two back-to-back runs at
    // the exact same `now`.
    const second = await runOperationsRetentionAt(prisma, now);
    assert.equal(second.deleted.metricSamples, 0);
    assert.equal(second.deleted.detectorRuns, 0);
    assert.equal(second.deleted.resolvedSignals, 0);
    assert.equal(second.deleted.abortedSignals, 0);

    console.log("runOperationsRetention.test.ts: OK");
  } finally {
    await prisma.operationalSignal.deleteMany({ where: { detector: `retention-test-${marker}` } });
    await prisma.detectorRun.deleteMany({ where: { detector: `retention-test-${marker}` } });
    await prisma.metricSample.deleteMany({ where: { metric: `retention.test.${marker}` } });
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
