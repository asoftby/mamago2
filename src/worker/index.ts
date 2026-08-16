/**
 * Operations Center worker entrypoint (§21 Step 2, Phases G/H).
 *
 * Separate Node process from the web server — same image, different
 * command (`node dist/worker/index.js`), no HTTP server, no published
 * port. Stays alive purely to run the snapshot-builder scheduler; detector
 * execution scheduling infrastructure is present but schedules nothing
 * while DetectorRegistry is empty (Step 2 has zero detectors).
 */
import { listDetectors } from "@/server/ops/detectorRegistry";
import { buildSnapshot } from "@/server/ops/snapshot/buildSnapshot";
import { createWorkerContext, disposeWorkerContext, type WorkerContext } from "./context";
import { Scheduler } from "./scheduler";

const SNAPSHOT_INTERVAL_MS = 60_000;

function wireScheduler(scheduler: Scheduler, ctx: WorkerContext): void {
  scheduler.scheduleRepeating({
    name: "operations.snapshot_builder",
    intervalMs: SNAPSHOT_INTERVAL_MS,
    run: async () => {
      const result = await buildSnapshot({ prisma: ctx.prisma, lock: ctx.lock });
      if (!result.attempted) {
        console.log("[worker] snapshot build skipped — lock held elsewhere");
      } else if (!result.accepted) {
        console.warn("[worker] snapshot build rejected — a newer startedAt was already stored");
      }
    },
  });

  // Detector execution scheduling infrastructure. DetectorRegistry is
  // empty in Step 2, so this loop legitimately registers zero tasks.
  for (const detector of listDetectors()) {
    scheduler.scheduleRepeating({
      name: `detector:${detector.name}`,
      intervalMs: detector.intervalSec * 1000,
      run: async () => {
        // Step 3+ wires executeDetector(detector, ctx, ...) here.
      },
    });
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the Operations worker");
  }

  const ctx = await createWorkerContext(databaseUrl);
  console.log(
    `[worker] started workerId=${ctx.workerId} workerStartedAt=${ctx.workerStartedAt.toISOString()} detectors=${listDetectors().length}`,
  );

  const scheduler = new Scheduler();
  wireScheduler(scheduler, ctx);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker] received ${signal}, shutting down`);
    scheduler.stop();
    disposeWorkerContext(ctx)
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
