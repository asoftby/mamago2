import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Migration: additive, nullable, no backfill, no index (index moves to A2).
const sql = read("prisma/migrations/20261003120000_user_event_family_context/migration.sql");
assert.match(sql, /CREATE TYPE "PlanVisibility" AS ENUM \('PRIVATE', 'FAMILY'\)/);
assert.match(sql, /ADD COLUMN "familyId" TEXT/);
assert.match(sql, /ADD COLUMN "planVisibility" "PlanVisibility"/);
assert.doesNotMatch(sql, /NOT NULL/i);
assert.doesNotMatch(sql, /DEFAULT/i);
assert.doesNotMatch(sql, /UPDATE\s+"UserEvent"/i);
assert.doesNotMatch(sql, /CREATE\s+(UNIQUE\s+)?INDEX/i);
assert.doesNotMatch(sql, /ALTER TYPE "UserEventType"/i);

// Schema: both columns nullable on UserEvent.
const schema = read("prisma/schema.prisma");
const model = schema.match(/model UserEvent \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.match(model, /familyId\s+String\?/);
assert.match(model, /planVisibility\s+PlanVisibility\?/);

// Public ingestion must not accept or forward the server-only fields.
const route = read("src/app/api/analytics/events/route.ts");
assert.doesNotMatch(route, /familyId|planVisibility/);

// Other raw writers keep writing NULL until a caller opts in server-side.
for (const p of [
  "src/lib/decision/subjects.ts",
  "src/app/api/articles/[articleId]/analytics/batch/route.ts",
]) {
  assert.doesNotMatch(read(p), /familyId|planVisibility/, p);
}

// The service passes the fields through only when provided.
const svc = read("src/server/services/analytics/AnalyticsEventService.ts");
assert.match(svc, /familyId: input\.familyId \?\? undefined/);
assert.match(svc, /planVisibility: input\.planVisibility \?\? undefined/);

console.log("userEventFamilyContext.contract.test.ts: OK");
