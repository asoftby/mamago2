import assert from "node:assert/strict";
import test from "node:test";

import { assertLocalDatabaseUrl, parseUserMigrationArgs } from "./migration-user-vertical-slice";

test("targeted CLI accepts exactly one approved user key", () => {
  assert.equal(parseUserMigrationArgs(["--entity", "user", "--source-record-key", "wordpress-db:user:7"]).sourceRecordKey, "wordpress-db:user:7");
  assert.throws(() => parseUserMigrationArgs(["--entity", "user", "--source-record-key", "wordpress-db:user:8"]));
  assert.throws(() => parseUserMigrationArgs(["--entity", "user", "--source-record-key", "wordpress-db:user:7", "--limit", "1"]));
});

test("DB gate allows only the approved local database", () => {
  assert.doesNotThrow(() => assertLocalDatabaseUrl("postgresql://u:p@localhost:5433/mamago2"));
  assert.throws(() => assertLocalDatabaseUrl("postgresql://u:p@example.com:5432/mamago2"));
  assert.throws(() => assertLocalDatabaseUrl("postgresql://u:p@localhost:5433/other"));
});
