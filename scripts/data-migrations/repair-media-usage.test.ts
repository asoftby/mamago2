import assert from "node:assert/strict";
import { assertCanonicalEnvironment } from "./backfill-media-canonical-names";
import { parseMediaUsageRepairCliArgs } from "./repair-media-usage";

assert.deepEqual(parseMediaUsageRepairCliArgs([]), {
  apply: false,
  allowProduction: false,
});
assert.deepEqual(parseMediaUsageRepairCliArgs(["--dry-run"]), {
  apply: false,
  allowProduction: false,
});
assert.deepEqual(parseMediaUsageRepairCliArgs(["--apply"]), {
  apply: true,
  allowProduction: false,
});
assert.deepEqual(parseMediaUsageRepairCliArgs(["--apply", "--allow-production"]), {
  apply: true,
  allowProduction: true,
});
assert.throws(() => parseMediaUsageRepairCliArgs(["--apply", "--dry-run"]), /Choose either/);

const oldAppEnv = process.env.APP_ENV;

function withAppEnv<T>(value: string | undefined, run: () => T): T {
  if (value === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = value;
  try {
    return run();
  } finally {
    if (oldAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = oldAppEnv;
  }
}

// DEV dry-run allowed
withAppEnv("local", () => {
  assert.equal(
    assertCanonicalEnvironment({
      databaseUrl: "postgresql://x:x@localhost:5433/mamago2",
      currentDatabase: "mamago2",
      apply: false,
      allowProduction: false,
    }).production,
    false,
  );
});

// DEV apply allowed without production flag
withAppEnv("local", () => {
  assert.equal(
    assertCanonicalEnvironment({
      databaseUrl: "postgresql://x:x@localhost:5433/mamago2",
      currentDatabase: "mamago2",
      apply: true,
      allowProduction: false,
    }).production,
    false,
  );
});

// PROD dry-run allowed
withAppEnv("production", () => {
  assert.equal(
    assertCanonicalEnvironment({
      databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
      currentDatabase: "prodmamago",
      apply: false,
      allowProduction: false,
    }).production,
    true,
  );
});

// PROD apply without --allow-production rejected
withAppEnv("production", () => {
  assert.throws(
    () =>
      assertCanonicalEnvironment({
        databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
        currentDatabase: "prodmamago",
        apply: true,
        allowProduction: false,
      }),
    /--allow-production/,
  );
});

// PROD apply with --allow-production allowed only with matching production fingerprint
withAppEnv("production", () => {
  assert.equal(
    assertCanonicalEnvironment({
      databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
      currentDatabase: "prodmamago",
      apply: true,
      allowProduction: true,
    }).production,
    true,
  );
  assert.throws(
    () =>
      assertCanonicalEnvironment({
        databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
        currentDatabase: "mamago2",
        apply: true,
        allowProduction: true,
      }),
    /does not match DATABASE_URL/,
  );
});

// Production DB name alone is enough even when APP_ENV is non-prod
withAppEnv("local", () => {
  assert.throws(
    () =>
      assertCanonicalEnvironment({
        databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
        currentDatabase: "prodmamago",
        apply: true,
        allowProduction: false,
      }),
    /--allow-production/,
  );
});

// --allow-production against DEV rejected
withAppEnv("local", () => {
  assert.throws(
    () =>
      assertCanonicalEnvironment({
        databaseUrl: "postgresql://x:x@localhost:5433/mamago2",
        currentDatabase: "mamago2",
        apply: true,
        allowProduction: true,
      }),
    /non-production/,
  );
});

console.log("repair-media-usage.test.ts: OK");
