/**
 * Session-level advisory lock verification (§21 Step 2, Phase E).
 * Real PostgreSQL advisory locks — no mock. Run against an isolated,
 * disposable database (never the shared dev DB), same strategy proven in
 * Step 1.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/lock/GlobalLock.test.ts
 */
import assert from "node:assert/strict";

import { GlobalLock, detectorLockName, SNAPSHOT_BUILDER_LOCK_NAME } from "./GlobalLock";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  // 1. Client A acquires lock X -> true.
  const a = new GlobalLock(DATABASE_URL!);
  await a.connect();
  const lockX = detectorLockName("test-lock-x");
  assert.equal(await a.tryAcquire(lockX), true, "A must acquire X");

  // 2. Independent client B tries lock X -> false.
  const b = new GlobalLock(DATABASE_URL!);
  await b.connect();
  assert.equal(await b.tryAcquire(lockX), false, "B must NOT acquire X while A holds it");

  // 6. A different lock name can coexist with X being held.
  assert.equal(
    await b.tryAcquire(SNAPSHOT_BUILDER_LOCK_NAME),
    true,
    "B must be able to acquire an unrelated lock name concurrently",
  );
  assert.equal(await b.release(SNAPSHOT_BUILDER_LOCK_NAME), true);

  // 3. A releases X.
  assert.equal(await a.release(lockX), true, "A must release X");

  // 4. B can now acquire X -> true.
  assert.equal(await b.tryAcquire(lockX), true, "B must acquire X after A released it");
  assert.equal(await b.release(lockX), true);

  await a.close();
  await b.close();

  // 5. Closing the owning session releases its lock (no explicit release call).
  const c = new GlobalLock(DATABASE_URL!);
  await c.connect();
  const lockY = detectorLockName("test-lock-y");
  assert.equal(await c.tryAcquire(lockY), true, "C must acquire Y");
  await c.close(); // session ends without calling release()

  const d = new GlobalLock(DATABASE_URL!);
  await d.connect();
  assert.equal(
    await d.tryAcquire(lockY),
    true,
    "D must be able to acquire Y after C's session closed without releasing",
  );
  assert.equal(await d.release(lockY), true);
  await d.close();

  console.log("GlobalLock.test.ts: OK");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
