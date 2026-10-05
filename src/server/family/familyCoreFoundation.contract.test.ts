import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const sql = read("prisma/migrations/20261004120000_family_core_foundation/migration.sql");

// Enums: PlanVisibility already exists (A1) and must not be re-created.
assert.doesNotMatch(sql, /CREATE TYPE "PlanVisibility"/);
for (const e of ["FamilyRole", "FamilyHistoryAccess", "PlanDecisionStatus"]) {
  assert.match(sql, new RegExp(`CREATE TYPE "${e}" AS ENUM`));
}

// Partial unique invariants.
assert.match(
  sql,
  /CREATE UNIQUE INDEX "FamilyMembership_active_user" ON "FamilyMembership"\("userId"\) WHERE "leftAt" IS NULL/,
);
assert.match(
  sql,
  /CREATE UNIQUE INDEX "FamilyMembership_active_owner" ON "FamilyMembership"\("familyId"\) WHERE "role" = 'OWNER' AND "leftAt" IS NULL/,
);

// Private items can never be proposals.
assert.match(sql, /CHECK \(NOT \("visibility" = 'PRIVATE' AND "status" = 'PROPOSED'\)\)/);

// Defaults keep every existing row valid and equivalent to a one-adult family.
assert.match(sql, /"visibility" "PlanVisibility" NOT NULL DEFAULT 'FAMILY'/);
assert.match(sql, /"status" "PlanDecisionStatus" NOT NULL DEFAULT 'CONFIRMED'/);

// B1 is additive: no data writes, no drops, no destructive DDL, no NOT NULL familyId.
assert.doesNotMatch(sql, /\bUPDATE\s+"|\bINSERT\s+INTO|\bDELETE\s+FROM|\bDROP\b/i);
assert.doesNotMatch(sql, /"familyId" TEXT NOT NULL,\s*\n\s*"userId"[^;]*Child/);
assert.match(sql, /ALTER TABLE "Child" ADD COLUMN "familyId" TEXT,\s*\nADD COLUMN "createdById" TEXT;/);

// Out of B1 scope: nothing for future entities.
for (const forbidden of ["PlanItemSubject", "ConsentRecord", "FamilyInvite"]) {
  assert.doesNotMatch(sql, new RegExp(forbidden));
}
assert.doesNotMatch(sql, /BookingRequest/);

// Old ownership fields stay untouched.
assert.doesNotMatch(sql, /"parentId"|"cancelledAt"/);
const schema = read("prisma/schema.prisma");
assert.match(schema, /model Child \{[\s\S]*?\n\s+parentId\s+String\n/);

// Cache version must be bumped with every schema change.
assert.match(read("src/lib/prisma.ts"), /PRISMA_CACHE_VERSION = "v14"/);

// B1 does not switch production reads. delete-account became family-aware in
// B3, but must never create a family or depend on the reads flag.
const deleteFlow = read("src/server/account/deleteAccount.service.ts");
assert.doesNotMatch(deleteFlow, /ensureFamily|FAMILY_CORE_READS|familyCoreReads/);
// Backfill script exposes the agreed modes and stops on cross-owner rows.
const script = read("scripts/family-core-backfill.ts");
assert.match(script, /--dry-run/);
assert.match(script, /--events/);
const lib = read("src/server/family/familyBackfill.ts");
assert.match(lib, /cross_owner_plan_child/);
assert.match(lib, /EVENT_BATCH_SIZE = 10_000/);
assert.doesNotMatch(lib, /planVisibility/);

// The prod image has no scripts/ or tsx: the backfill must ship as dist/ops/*.
assert.match(read("tsup.worker.config.ts"), /"ops\/family-core-backfill":\s*"scripts\/family-core-backfill\.ts"/);

console.log("familyCoreFoundation.contract.test.ts: OK");
