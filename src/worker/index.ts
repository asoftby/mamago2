/**
 * Operations Center worker entrypoint (§21 Step 2 Phases G/H, extended by
 * Step 3/4 Phase G, Step 5 Phase L, Step 6 Phase P).
 *
 * Separate Node process from the web server — same image, different
 * command (`node dist/worker/index.js`), no HTTP server, no published
 * port. Runs the snapshot-builder scheduler, all seven registered
 * detectors, all nine registered metric collectors, and the retention
 * job at their configured intervals — this file never hardcodes a
 * detector/collector list, it wires whatever DetectorRegistry/
 * MetricCollectorRegistry currently contain.
 */
import type { DetectorRunCounts } from "@/server/ops/detectorRun";
import { executeDetector } from "@/server/ops/detectorRun";
import { registerCoreDetectors } from "@/server/ops/detectors";
import { extractHealthReleaseMetadata, type HealthEndpointProbeOutcome } from "@/server/ops/detectors/healthEndpoint";
import { listDetectors } from "@/server/ops/detectorRegistry";
import { GlobalLock } from "@/server/ops/lock/GlobalLock";
import { runMetricCollector } from "@/server/ops/metrics/collectorRun";
import { registerCoreMetricCollectors } from "@/server/ops/metrics/collectors";
import { listMetricCollectors } from "@/server/ops/metrics/metricCollectorRegistry";
import { persistDetectorResult } from "@/server/ops/persistDetectorResult";
import { observeReleaseEvent } from "@/server/ops/releaseEvent";
import { runOperationsRetentionWithLock } from "@/server/ops/retention/retentionRun";
import { buildSnapshot } from "@/server/ops/snapshot/buildSnapshot";
import type { Detector, DetectorContext, DetectorResult } from "@/server/ops/types";
import { createWorkerContext, disposeWorkerContext, type WorkerContext } from "./context";
import { Scheduler } from "./scheduler";

const SNAPSHOT_INTERVAL_MS = 60_000;
const RETENTION_INTERVAL_MS = 86_400_000;
/**
 * Deterministic per-collector startup stagger, so nine collectors don't
 * all open their first DB round-trip in the same tick as the seven
 * detectors and the snapshot builder. Detector/snapshot cadence and
 * their own immediate-run behavior are unchanged (§21 Step 5, Phase L).
 */
const COLLECTOR_STARTUP_STAGGER_MS = 250;
/**
 * Retention's first run is deferred until after the collector stagger
 * group has had its own turn, so a fresh deploy's startup burst resolves
 * detectors → collectors → retention in that order rather than all at
 * once (§21 Step 6, Phase L).
 */
const RETENTION_STARTUP_DELAY_MS = 5_000;

function makePersistResult(
  ctx: WorkerContext,
  detector: Detector<unknown>,
): (result: DetectorResult, probe: unknown) => Promise<DetectorRunCounts> {
  return async (result, probe) => {
    const counts = await persistDetectorResult(ctx.prisma, detector.name, result, detector.hysteresis);

    if (detector.name === "health_endpoint") {
      const meta = extractHealthReleaseMetadata(probe as HealthEndpointProbeOutcome);
      if (meta) {
        const { kind } = await observeReleaseEvent(ctx.prisma, meta);
        if (kind) {
          console.log(
            `[worker] release_event kind=${kind} buildId=${meta.buildId} gitSha=${meta.gitSha ?? "null"} processStartedAt=${meta.processStartedAt.toISOString()}`,
          );
        }
      }
    }

    return counts;
  };
}

/**
 * Each scheduled task gets its OWN dedicated GlobalLock connection. The
 * snapshot builder and all detectors run on independent schedules that
 * can legitimately overlap in real time (e.g. everything fires together
 * on worker startup) — a single shared `pg.Client` cannot safely serve
 * concurrent, interleaved queries from multiple in-flight tasks. Step 2's
 * ctx.lock remains dedicated to the snapshot builder only.
 */
function wireScheduler(
  scheduler: Scheduler,
  ctx: WorkerContext,
  detectorLocks: Map<string, GlobalLock>,
  collectorLocks: Map<string, GlobalLock>,
  retentionLock: GlobalLock,
): void {
  scheduler.scheduleRepeating({
    name: "operations.snapshot_builder",
    intervalMs: SNAPSHOT_INTERVAL_MS,
    run: async () => {
      const result = await buildSnapshot({ prisma: ctx.prisma, lock: ctx.lock, workerStartedAt: ctx.workerStartedAt });
      if (!result.attempted) {
        console.log("[worker] snapshot build skipped — lock held elsewhere");
      } else if (!result.accepted) {
        console.warn("[worker] snapshot build rejected — a newer startedAt was already stored");
      }
    },
  });

  for (const detector of listDetectors()) {
    const persistResult = makePersistResult(ctx, detector);
    const lock = detectorLocks.get(detector.name);
    if (!lock) throw new Error(`No dedicated lock connection for detector "${detector.name}"`);

    scheduler.scheduleRepeating({
      name: `detector:${detector.name}`,
      intervalMs: detector.intervalSec * 1000,
      run: async () => {
        const detectorCtx: DetectorContext = {
          prisma: ctx.prisma,
          fetch: globalThis.fetch,
          workerStartedAt: ctx.workerStartedAt,
        };
        const run = await executeDetector(detector, detectorCtx, {
          prisma: ctx.prisma,
          lock,
          workerId: ctx.workerId,
          persistResult,
        });
        console.log(
          `[worker] detector=${detector.name} status=${run.status} durationMs=${run.durationMs ?? "null"} signalsOpened=${run.signalsOpened} signalsResolved=${run.signalsResolved} samplesWritten=${run.samplesWritten}`,
        );
      },
    });
  }

  listMetricCollectors().forEach((collector, index) => {
    const lock = collectorLocks.get(collector.name);
    if (!lock) throw new Error(`No dedicated lock connection for metric collector "${collector.name}"`);

    scheduler.scheduleRepeating({
      name: `metric_collector:${collector.name}`,
      intervalMs: collector.intervalSec * 1000,
      // First run is deferred by a deterministic per-collector stagger
      // instead of firing immediately alongside every detector and the
      // snapshot builder on worker startup.
      runImmediately: false,
      run: async () => {
        const run = await runMetricCollector(collector, { prisma: ctx.prisma, lock });
        console.log(
          `[worker] metric_collector=${collector.name} attempted=${run.attempted} succeeded=${run.succeeded} samplesWritten=${run.samplesWritten}`,
        );
      },
    });

    setTimeout(() => {
      void scheduler.runNow(`metric_collector:${collector.name}`);
    }, index * COLLECTOR_STARTUP_STAGGER_MS);
  });

  scheduler.scheduleRepeating({
    name: "operations.retention",
    intervalMs: RETENTION_INTERVAL_MS,
    runImmediately: false,
    run: async () => {
      const outcome = await runOperationsRetentionWithLock(ctx.prisma, retentionLock);
      if (!outcome.attempted) {
        console.log("[worker] retention run skipped — lock held elsewhere");
      } else if (!outcome.succeeded) {
        console.warn("[worker] retention run failed — will retry on the next scheduled cycle");
      } else if (outcome.result) {
        const { deleted } = outcome.result;
        console.log(
          `[worker] retention run succeeded metricSamples=${deleted.metricSamples} detectorRuns=${deleted.detectorRuns} resolvedSignals=${deleted.resolvedSignals} abortedSignals=${deleted.abortedSignals}`,
        );
      }
    },
  });
  setTimeout(() => {
    void scheduler.runNow("operations.retention");
  }, RETENTION_STARTUP_DELAY_MS);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the Operations worker");
  }

  registerCoreDetectors();
  registerCoreMetricCollectors();

  const ctx = await createWorkerContext(databaseUrl);
  console.log(
    `[worker] started workerId=${ctx.workerId} workerStartedAt=${ctx.workerStartedAt.toISOString()} detectors=${listDetectors()
      .map((d) => d.name)
      .join(",")} metricCollectors=${listMetricCollectors()
      .map((c) => c.name)
      .join(",")}`,
  );

  const detectorLocks = new Map<string, GlobalLock>();
  for (const detector of listDetectors()) {
    const lock = new GlobalLock(databaseUrl);
    await lock.connect();
    detectorLocks.set(detector.name, lock);
  }

  const collectorLocks = new Map<string, GlobalLock>();
  for (const collector of listMetricCollectors()) {
    const lock = new GlobalLock(databaseUrl);
    await lock.connect();
    collectorLocks.set(collector.name, lock);
  }

  const retentionLock = new GlobalLock(databaseUrl);
  await retentionLock.connect();

  const scheduler = new Scheduler();
  wireScheduler(scheduler, ctx, detectorLocks, collectorLocks, retentionLock);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker] received ${signal}, shutting down`);
    scheduler.stop();
    Promise.all([
      disposeWorkerContext(ctx),
      ...Array.from(detectorLocks.values()).map((lock) => lock.close()),
      ...Array.from(collectorLocks.values()).map((lock) => lock.close()),
      retentionLock.close(),
    ])
      .catch((err) => console.error("[worker] error during shutdown:", err))
      .finally(() => process.exit(0));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal error during startup:", err);
  process.exit(1);
});
