/**
 * Pure scheduler tests — no DB required.
 * Run: npx tsx src/worker/scheduler.test.ts
 */
import assert from "node:assert/strict";

import { Scheduler } from "./scheduler";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Runs immediately, then again on each interval tick.
  {
    const scheduler = new Scheduler();
    let runs = 0;
    scheduler.scheduleRepeating({
      name: "t1",
      intervalMs: 30,
      run: async () => {
        runs += 1;
      },
    });
    await sleep(10); // immediate run
    assert.equal(runs, 1, "must run immediately by default");
    await sleep(80); // ~2 more ticks at 30ms
    assert.ok(runs >= 2, `expected at least 2 more runs, got ${runs}`);
    scheduler.stop();
    const afterStop = runs;
    await sleep(80);
    assert.equal(runs, afterStop, "no further runs after stop()");
  }

  // Overlapping ticks are skipped, never run concurrently with themselves.
  {
    const scheduler = new Scheduler();
    let concurrent = 0;
    let maxConcurrent = 0;
    let completedRuns = 0;
    scheduler.scheduleRepeating({
      name: "slow",
      intervalMs: 10,
      run: async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await sleep(50); // much slower than the 10ms interval
        concurrent -= 1;
        completedRuns += 1;
      },
    });
    await sleep(120);
    scheduler.stop();
    assert.equal(maxConcurrent, 1, "a slow task must never overlap with itself");
    assert.ok(completedRuns >= 1, "at least one run must have completed");
  }

  // Duplicate task names are rejected.
  {
    const scheduler = new Scheduler();
    scheduler.scheduleRepeating({ name: "dup", intervalMs: 1000, run: async () => {} });
    assert.throws(() =>
      scheduler.scheduleRepeating({ name: "dup", intervalMs: 1000, run: async () => {} }),
    );
    scheduler.stop();
  }

  // runImmediately: false suppresses the startup-tick fire; interval ticks still happen.
  {
    const scheduler = new Scheduler();
    let runs = 0;
    scheduler.scheduleRepeating({
      name: "deferred",
      intervalMs: 30,
      runImmediately: false,
      run: async () => {
        runs += 1;
      },
    });
    await sleep(10);
    assert.equal(runs, 0, "must not run immediately when runImmediately is false");
    await sleep(40);
    assert.ok(runs >= 1, "interval ticks must still fire");
    scheduler.stop();
  }

  // runNow() manually fires a task's tick on demand (used for a deterministic startup stagger).
  {
    const scheduler = new Scheduler();
    let runs = 0;
    scheduler.scheduleRepeating({
      name: "manual",
      intervalMs: 10_000,
      runImmediately: false,
      run: async () => {
        runs += 1;
      },
    });
    assert.equal(runs, 0);
    await scheduler.runNow("manual");
    assert.equal(runs, 1, "runNow must trigger the task's run function");
    await assert.rejects(() => scheduler.runNow("does-not-exist"));
    scheduler.stop();
  }

  console.log("scheduler.test.ts: OK");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
