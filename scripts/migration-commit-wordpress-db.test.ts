import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MigrationLineageLookup } from "../src/lib/migration/core/orchestrator";
import { buildExecutionPlanInput, parseArgs, parseCommitContextConfig } from "./migration-commit-wordpress-db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_FLAGS = ["--context-config", "config.json", "--confirm-writes"];

function testParsesValidFlags() {
  const args = parseArgs([
    "--entity",
    "place",
    "--context-config",
    "config.json",
    "--confirm-writes",
    "--limit",
    "5",
    "--allow-remote-readonly",
    "--out",
    "report.json",
  ]);

  assert.deepEqual(args, {
    entity: "place",
    contextConfigPath: "config.json",
    confirmWrites: true,
    limit: 5,
    allowRemoteReadonly: true,
    out: "report.json",
  });
}

function testDefaultsWhenOptionalFlagsOmitted() {
  const args = parseArgs(REQUIRED_FLAGS);

  assert.equal(args.entity, "all");
  assert.equal(args.limit, undefined);
  assert.equal(args.allowRemoteReadonly, false);
  assert.equal(args.out, undefined);
}

function testMissingConfirmWritesBlocksBeforeConnection() {
  assert.throws(
    () => parseArgs(["--entity", "place", "--context-config", "config.json"]),
    /--confirm-writes/,
    "omitting --confirm-writes must throw synchronously inside parseArgs, before any connection is attempted",
  );
}

function testMissingContextConfigBlocksBeforeConnection() {
  assert.throws(
    () => parseArgs(["--entity", "place", "--confirm-writes"]),
    /--context-config/,
    "omitting --context-config must throw synchronously inside parseArgs, before any connection is attempted",
  );
}

function testInvalidEntityFails() {
  assert.throws(
    () => parseArgs(["--entity", "offer", ...REQUIRED_FLAGS]),
    /Invalid --entity value "offer"/,
  );
}

function testInvalidLimitFails() {
  assert.throws(
    () => parseArgs(["--limit", "not-a-number", ...REQUIRED_FLAGS]),
    /Invalid --limit value/,
  );
  assert.throws(
    () => parseArgs(["--limit", "-5", ...REQUIRED_FLAGS]),
    /Invalid --limit value/,
  );
  assert.throws(
    () => parseArgs(["--limit", "0", ...REQUIRED_FLAGS]),
    /Invalid --limit value/,
  );
}

function testValidEntityValuesAllParse() {
  for (const entity of ["article", "place", "event", "all"]) {
    const args = parseArgs(["--entity", entity, ...REQUIRED_FLAGS]);
    assert.equal(args.entity, entity);
  }
}

function testConfigJsonParsedWhenValid() {
  const config = parseCommitContextConfig(
    JSON.stringify({
      defaults: { place: { createdByUserId: "user-1" } },
      overridesBySourceRecordKey: { "wordpress-db:places:301": { place: { cityId: "city-1" } } },
    }),
    "config.json",
  );

  assert.deepEqual(config.defaults, { place: { createdByUserId: "user-1" } });
  assert.deepEqual(config.overridesBySourceRecordKey, {
    "wordpress-db:places:301": { place: { cityId: "city-1" } },
  });
}

function testConfigJsonAllowsEmptyObject() {
  const config = parseCommitContextConfig("{}", "config.json");
  assert.deepEqual(config, {});
}

function testConfigInvalidJsonFails() {
  assert.throws(() => parseCommitContextConfig("{not valid json", "config.json"), /not valid JSON/);
}

function testConfigNonObjectShapeFails() {
  assert.throws(() => parseCommitContextConfig("[]", "config.json"), /must be a JSON object/);
  assert.throws(() => parseCommitContextConfig("42", "config.json"), /must be a JSON object/);
  assert.throws(() => parseCommitContextConfig("null", "config.json"), /must be a JSON object/);
}

function testConfigDefaultsMustBeObjectIfPresent() {
  assert.throws(
    () => parseCommitContextConfig(JSON.stringify({ defaults: "not-an-object" }), "config.json"),
    /"defaults" must be an object/,
  );
  assert.throws(
    () => parseCommitContextConfig(JSON.stringify({ overridesBySourceRecordKey: ["nope"] }), "config.json"),
    /"overridesBySourceRecordKey" must be an object/,
  );
}

function testPackageScriptExists() {
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.["migration:commit:wordpress-db"],
    "tsx scripts/migration-commit-wordpress-db.ts",
  );
}

// A fake `MigrationLineageLookup` — never a real `MigrationLedgerRepository`/
// `PrismaClient` — proving `buildExecutionPlanInput()` wires whatever ledger
// it's given straight through, without needing a real DB connection to test it.
function createFakeLedger(): MigrationLineageLookup {
  return {
    async findLineageBySourceRecordKeys() {
      return new Map();
    },
  };
}

function testBuildExecutionPlanInputPassesLedgerThrough() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({ entity: "place", executor, ledger });

  assert.equal(input.ledger, ledger, "the ledger passed in must land on the built input unchanged, not be dropped or replaced");
}

function testBuildExecutionPlanInputMapsEntityToEntityTypes() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  assert.deepEqual(buildExecutionPlanInput({ entity: "place", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:places",
  ]);
  assert.deepEqual(buildExecutionPlanInput({ entity: "article", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:post",
  ]);
  assert.deepEqual(buildExecutionPlanInput({ entity: "event", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:events",
  ]);
  assert.equal(buildExecutionPlanInput({ entity: "all", executor, ledger }).filters?.entityTypes, undefined);
}

function testBuildExecutionPlanInputPassesLimitThrough() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({ entity: "all", limit: 5, executor, ledger });
  assert.equal(input.filters?.limit, 5);
}

function main() {
  testParsesValidFlags();
  testDefaultsWhenOptionalFlagsOmitted();
  testMissingConfirmWritesBlocksBeforeConnection();
  testMissingContextConfigBlocksBeforeConnection();
  testInvalidEntityFails();
  testInvalidLimitFails();
  testValidEntityValuesAllParse();
  testConfigJsonParsedWhenValid();
  testConfigJsonAllowsEmptyObject();
  testConfigInvalidJsonFails();
  testConfigNonObjectShapeFails();
  testConfigDefaultsMustBeObjectIfPresent();
  testPackageScriptExists();
  testBuildExecutionPlanInputPassesLedgerThrough();
  testBuildExecutionPlanInputMapsEntityToEntityTypes();
  testBuildExecutionPlanInputPassesLimitThrough();
}

// No real DB/SSH anywhere in this file — only `parseArgs()`/
// `parseCommitContextConfig()`/`buildExecutionPlanInput()` (all pure) and a
// read of package.json are exercised. `main()` (the actual WP/Prisma
// wiring) is never called. `buildExecutionPlanInput()`'s ledger tests use a
// fake `MigrationLineageLookup`, never a real `MigrationLedgerRepository`
// or `PrismaClient`.
main();
console.log("migration-commit-wordpress-db tests: OK");
