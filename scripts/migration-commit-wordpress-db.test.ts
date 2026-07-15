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
    sourceRecordKey: undefined,
    forceReprocess: false,
    allowRemoteReadonly: true,
    out: "report.json",
    profileName: undefined,
    mediaPolicyName: undefined,
    seoPolicyName: undefined,
    redirectPolicyName: undefined,
    confirmProduction: false,
  });
}

function testDefaultsWhenOptionalFlagsOmitted() {
  const args = parseArgs(REQUIRED_FLAGS);

  assert.equal(args.entity, "all");
  assert.equal(args.limit, undefined);
  assert.equal(args.allowRemoteReadonly, false);
  assert.equal(args.forceReprocess, false);
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
  for (const entity of ["article", "place", "event", "route", "all"]) {
    const args = parseArgs(["--entity", entity, ...REQUIRED_FLAGS]);
    assert.equal(args.entity, entity);
  }
}

function testForceReprocessRequiresArticleAndSourceRecordKey() {
  assert.throws(
    () => parseArgs(["--entity", "place", "--force-reprocess", ...REQUIRED_FLAGS]),
    /--entity article/,
  );
  assert.throws(
    () => parseArgs(["--entity", "article", "--force-reprocess", ...REQUIRED_FLAGS]),
    /--source-record-key/,
  );

  const args = parseArgs([
    "--entity",
    "article",
    "--source-record-key",
    "wordpress-db:post:201",
    "--force-reprocess",
    ...REQUIRED_FLAGS,
  ]);
  assert.equal(args.forceReprocess, true);
}

function testForceReprocessDisallowsMassModeLimit() {
  assert.throws(
    () =>
      parseArgs([
        "--entity",
        "article",
        "--source-record-key",
        "wordpress-db:post:201",
        "--force-reprocess",
        "--limit",
        "5",
        ...REQUIRED_FLAGS,
      ]),
    /mass mode is not allowed/,
  );
}

function testProfileFlagParsesValidValues() {
  for (const profile of ["FULL_IMPORT", "DEV_VALIDATION", "PRODUCTION"]) {
    const args = parseArgs(["--profile", profile, ...REQUIRED_FLAGS]);
    assert.equal(args.profileName, profile);
  }
  assert.equal(parseArgs(REQUIRED_FLAGS).profileName, undefined);
}

function testInvalidProfileFails() {
  assert.throws(
    () => parseArgs(["--profile", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --profile value "bogus"/,
  );
}

function testMediaPolicyFlagParsesValidValues() {
  for (const policy of ["FULL", "METADATA", "NONE"]) {
    const args = parseArgs(["--media-policy", policy, ...REQUIRED_FLAGS]);
    assert.equal(args.mediaPolicyName, policy);
  }
}

function testInvalidMediaPolicyFails() {
  assert.throws(
    () => parseArgs(["--media-policy", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --media-policy value "bogus"/,
  );
}

function testSeoPolicyFlagParsesValidValues() {
  for (const policy of ["DRY_RUN", "VALIDATE", "PRODUCTION"]) {
    const args = parseArgs(["--seo-policy", policy, ...REQUIRED_FLAGS]);
    assert.equal(args.seoPolicyName, policy);
  }
}

function testInvalidSeoPolicyFails() {
  assert.throws(
    () => parseArgs(["--seo-policy", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --seo-policy value "bogus"/,
  );
}

function testRedirectPolicyFlagParsesValidValues() {
  for (const policy of ["VALIDATE", "APPLY"]) {
    const args = parseArgs(["--redirect-policy", policy, ...REQUIRED_FLAGS]);
    assert.equal(args.redirectPolicyName, policy);
  }
}

function testInvalidRedirectPolicyFails() {
  assert.throws(
    () => parseArgs(["--redirect-policy", "bogus", ...REQUIRED_FLAGS]),
    /Invalid --redirect-policy value "bogus"/,
  );
}

function testConfirmProductionFlagParses() {
  assert.equal(parseArgs(REQUIRED_FLAGS).confirmProduction, false);
  assert.equal(parseArgs(["--confirm-production", ...REQUIRED_FLAGS]).confirmProduction, true);
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
  assert.deepEqual(buildExecutionPlanInput({ entity: "route", executor, ledger }).filters?.entityTypes, [
    "wordpress-db:routes",
  ]);
  assert.equal(buildExecutionPlanInput({ entity: "all", executor, ledger }).filters?.entityTypes, undefined);
}

function testBuildExecutionPlanInputPassesLimitThrough() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({ entity: "all", limit: 5, executor, ledger });
  assert.equal(input.filters?.limit, 5);
}

function testBuildExecutionPlanInputPinsSingleRecordLimit() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({
    entity: "article",
    limit: 500,
    sourceRecordKey: "wordpress-db:post:201",
    records: [
      {
        sourceEntityType: "wordpress-db:post",
        sourceStableKey: "wordpress-db:post:201",
        sourceRecordKey: "wordpress-db:post:201",
      },
    ],
    executor,
    ledger,
  });

  assert.equal(input.filters?.limit, 1);
  assert.equal(input.records?.length, 1);
  assert.equal(input.records?.[0].sourceRecordKey, "wordpress-db:post:201");
}

/** A targeted Place run must pin `limit: 1` and carry exactly the one requested record — never the other 81 published Places. */
function testBuildExecutionPlanInputPinsSingleRecordLimitForPlace() {
  const ledger = createFakeLedger();
  const executor = async () => [];

  const input = buildExecutionPlanInput({
    entity: "place",
    limit: 82,
    sourceRecordKey: "wordpress-db:places:437",
    records: [
      {
        sourceEntityType: "wordpress-db:places",
        sourceStableKey: "wordpress-db:places:437",
        sourceRecordKey: "wordpress-db:places:437",
      },
    ],
    executor,
    ledger,
  });

  assert.equal(input.filters?.limit, 1);
  assert.equal(input.records?.length, 1);
  assert.equal(input.records?.[0].sourceRecordKey, "wordpress-db:places:437");
}

function main() {
  testParsesValidFlags();
  testDefaultsWhenOptionalFlagsOmitted();
  testMissingConfirmWritesBlocksBeforeConnection();
  testMissingContextConfigBlocksBeforeConnection();
  testInvalidEntityFails();
  testInvalidLimitFails();
  testValidEntityValuesAllParse();
  testForceReprocessRequiresArticleAndSourceRecordKey();
  testForceReprocessDisallowsMassModeLimit();
  testProfileFlagParsesValidValues();
  testInvalidProfileFails();
  testMediaPolicyFlagParsesValidValues();
  testInvalidMediaPolicyFails();
  testSeoPolicyFlagParsesValidValues();
  testInvalidSeoPolicyFails();
  testRedirectPolicyFlagParsesValidValues();
  testInvalidRedirectPolicyFails();
  testConfirmProductionFlagParses();
  testConfigJsonParsedWhenValid();
  testConfigJsonAllowsEmptyObject();
  testConfigInvalidJsonFails();
  testConfigNonObjectShapeFails();
  testConfigDefaultsMustBeObjectIfPresent();
  testPackageScriptExists();
  testBuildExecutionPlanInputPassesLedgerThrough();
  testBuildExecutionPlanInputMapsEntityToEntityTypes();
  testBuildExecutionPlanInputPassesLimitThrough();
  testBuildExecutionPlanInputPinsSingleRecordLimit();
  testBuildExecutionPlanInputPinsSingleRecordLimitForPlace();
}

// No real DB/SSH anywhere in this file — only `parseArgs()`/
// `parseCommitContextConfig()`/`buildExecutionPlanInput()` (all pure) and a
// read of package.json are exercised. `main()` (the actual WP/Prisma
// wiring) is never called. `buildExecutionPlanInput()`'s ledger tests use a
// fake `MigrationLineageLookup`, never a real `MigrationLedgerRepository`
// or `PrismaClient`.
main();
console.log("migration-commit-wordpress-db tests: OK");
