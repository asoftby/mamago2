import assert from "node:assert/strict";

import {
  assertLocalDatabaseUrl,
  assertMigrationDatabaseTarget,
  classifyMigrationDatabaseTarget,
  parseMigrationDatabaseUrl,
} from "./migrationDatabaseTarget";

const LOCAL = "postgresql://u:p@localhost:5433/mamago2";
const LOCAL_IP = "postgresql://u:p@127.0.0.1:5433/mamago2";
const PROD_TUNNEL = "postgresql://u:p@127.0.0.1:55432/prodmamago";
const PROD_DIRECT = "postgresql://u:p@prod-db.internal:5432/prodmamago";
const DEV = "postgresql://u:p@127.0.0.1:5432/devmamago";
const OTHER = "postgresql://u:p@example.com:5432/mamago2";

assert.equal(parseMigrationDatabaseUrl(LOCAL).database, "mamago2");
assert.equal(classifyMigrationDatabaseTarget(parseMigrationDatabaseUrl(LOCAL)), "LOCAL_GOLDEN");
assert.equal(classifyMigrationDatabaseTarget(parseMigrationDatabaseUrl(LOCAL_IP)), "LOCAL_GOLDEN");
assert.equal(classifyMigrationDatabaseTarget(parseMigrationDatabaseUrl(PROD_TUNNEL)), "PROD");
assert.equal(classifyMigrationDatabaseTarget(parseMigrationDatabaseUrl(PROD_DIRECT)), "PROD");
assert.equal(classifyMigrationDatabaseTarget(parseMigrationDatabaseUrl(DEV)), "UNKNOWN");
assert.equal(classifyMigrationDatabaseTarget(parseMigrationDatabaseUrl(OTHER)), "UNKNOWN");

assert.doesNotThrow(() => assertLocalDatabaseUrl(LOCAL));
assert.doesNotThrow(() => assertLocalDatabaseUrl(LOCAL_IP));
assert.throws(() => assertLocalDatabaseUrl(undefined), /DATABASE_URL is required/);
assert.throws(() => assertLocalDatabaseUrl(OTHER), /LOCAL_DB_GATE_FAILED/);
assert.throws(() => assertLocalDatabaseUrl(PROD_TUNNEL), /PRODUCTION_CONFIRMATION_REQUIRED|LOCAL_DB_GATE_FAILED/);
assert.throws(() => assertLocalDatabaseUrl("postgresql://u:p@localhost:5433/other"), /LOCAL_DB_GATE_FAILED/);

assert.equal(
  assertMigrationDatabaseTarget({ databaseUrl: LOCAL, confirmProduction: false }),
  "LOCAL_GOLDEN",
);

assert.throws(
  () => assertMigrationDatabaseTarget({ databaseUrl: PROD_TUNNEL, confirmProduction: false }),
  /PRODUCTION_CONFIRMATION_REQUIRED/,
);

assert.equal(
  assertMigrationDatabaseTarget({
    databaseUrl: PROD_TUNNEL,
    confirmProduction: true,
    confirmWrites: false,
    currentDatabase: "prodmamago",
    env: { MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "false" },
  }),
  "PROD",
);

assert.throws(
  () =>
    assertMigrationDatabaseTarget({
      databaseUrl: PROD_TUNNEL,
      confirmProduction: true,
      confirmWrites: true,
      acknowledgeProdUserImport: false,
      currentDatabase: "prodmamago",
      env: { MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "false" },
    }),
  /PROD_USER_IMPORT_ACK_REQUIRED/,
);

assert.equal(
  assertMigrationDatabaseTarget({
    databaseUrl: PROD_TUNNEL,
    confirmProduction: true,
    confirmWrites: true,
    currentDatabase: "prodmamago",
    requireProdUserAcknowledgement: false,
    env: { MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "false" },
  }),
  "PROD",
);

assert.equal(
  assertMigrationDatabaseTarget({
    databaseUrl: PROD_DIRECT,
    confirmProduction: true,
    confirmWrites: true,
    acknowledgeProdUserImport: true,
    currentDatabase: "prodmamago",
    env: { MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "false" },
  }),
  "PROD",
);

assert.throws(
  () =>
    assertMigrationDatabaseTarget({
      databaseUrl: PROD_TUNNEL,
      confirmProduction: true,
      confirmWrites: true,
      acknowledgeProdUserImport: true,
      currentDatabase: "mamago2",
      env: { MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "false" },
    }),
  /DATABASE_FINGERPRINT_MISMATCH/,
);

assert.throws(
  () =>
    assertMigrationDatabaseTarget({
      databaseUrl: PROD_TUNNEL,
      confirmProduction: true,
      confirmWrites: true,
      acknowledgeProdUserImport: true,
      currentDatabase: "prodmamago",
      env: { MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "true" },
    }),
  /EMAIL_GATE_OPEN/,
);

assert.throws(
  () =>
    assertMigrationDatabaseTarget({
      databaseUrl: DEV,
      confirmProduction: true,
      confirmWrites: true,
      acknowledgeProdUserImport: true,
    }),
  /DEV_DATABASE_REFUSED/,
);

assert.doesNotThrow(() =>
  assertMigrationDatabaseTarget({
    databaseUrl: LOCAL,
    confirmProduction: false,
    currentDatabase: "mamago2",
  }),
);

assert.throws(
  () =>
    assertMigrationDatabaseTarget({
      databaseUrl: LOCAL,
      confirmProduction: false,
      currentDatabase: "prodmamago",
    }),
  /DATABASE_FINGERPRINT_MISMATCH/,
);

console.log("migrationDatabaseTarget tests: OK");
