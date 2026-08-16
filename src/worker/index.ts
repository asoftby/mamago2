/**
 * Operations Center worker entrypoint (§21 Step 2 Phases G/H, extended by
 * Step 3/4 Phase G).
 *
 * Separate Node process from the web server — same image, different
 * command (`node dist/worker/index.js`), no HTTP server, no published
 * port. Runs the snapshot-builder scheduler plus all seven registered
 * detectors (see detectors/index.ts) at their configured intervals —
 * this file never hardcodes a detector list, it wires whatever
 * DetectorRegistry currently contains.
 */
import type { DetectorRunCounts } from "@/server/ops/detectorRun";
import { executeDetector } from "@/server/ops/detectorRun";
import { registerCoreDetectors } from "@/server/ops/detectors";
import { extractHealthReleaseMetadata, type HealthEndpointProbeOutcome } from "@/server/ops/detectors/healthEndpoint";
import { listDetectors } from "@/server/ops/detectorRegistry";
import { GlobalLock } from "@/server/ops/lock/GlobalLock";
import { persistDetectorResult } from "@/server/ops/persistDetectorResult";
import { observeReleaseEvent } from "@/server/ops/releaseEvent";
import { buildSnapshot } from "@/server/ops/snapshot/buildSnapshot";
import type { Detector, DetectorContext, DetectorResult } from "@/server/ops/types";
import { createWorkerContext, disposeWorkerContext, type WorkerContext } from "./context";
import { Scheduler } from "./scheduler";

const SNAPSHOT_INTERVAL_MS = 60_000;

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
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the Operations worker");
  }

  registerCoreDetectors();

  const ctx = await createWorkerContext(databaseUrl);
  console.log(
    `[worker] started workerId=${ctx.workerId} workerStartedAt=${ctx.workerStartedAt.toISOString()} detectors=${listDetectors()
      .map((d) => d.name)
      .join(",")}`,
  );

  const detectorLocks = new Map<string, GlobalLock>();
  for (const detector of listDetectors()) {
    const lock = new GlobalLock(databaseUrl);
    await lock.connect();
    detectorLocks.set(detector.name, lock);
  }

  const scheduler = new Scheduler();
  wireScheduler(scheduler, ctx, detectorLocks);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker] received ${signal}, shutting down`);
    scheduler.stop();
    Promise.all([disposeWorkerContext(ctx), ...Array.from(detectorLocks.values()).map((lock) => lock.close())])
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
