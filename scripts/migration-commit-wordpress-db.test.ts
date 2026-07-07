import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, parseCommitContextConfig } from "./migration-commit-wordpress-db";

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
}

// No real DB/SSH anywhere in this file — only `parseArgs()`/
// `parseCommitContextConfig()` (pure) and a read of package.json are
// exercised. `main()` (the actual WP/Prisma wiring) is never called.
main();
console.log("migration-commit-wordpress-db tests: OK");
