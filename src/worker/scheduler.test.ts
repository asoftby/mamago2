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

  console.log("scheduler.test.ts: OK");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
