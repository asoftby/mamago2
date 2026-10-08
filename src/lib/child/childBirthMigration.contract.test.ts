import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260930090000_child_birth_precision/migration.sql"),
  "utf8",
);
assert.match(sql, /CREATE TYPE "BirthPrecision" AS ENUM \('DAY', 'MONTH'\)/);
assert.match(sql, /ADD COLUMN "birthPrecision" "BirthPrecision"/);
assert.match(sql, /ALTER COLUMN "name" DROP NOT NULL/);
assert.doesNotMatch(sql, /UPDATE\s+"Child"/i);
assert.doesNotMatch(sql, /DEFAULT/i);
console.log("childBirthMigration.contract.test.ts: OK");
