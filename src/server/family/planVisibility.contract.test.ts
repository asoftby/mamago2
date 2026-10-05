import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const sql = read("prisma/migrations/20261006180000_plan_visibility_events/migration.sql");
const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
assert.doesNotMatch(code, /^\s*(DROP |DELETE FROM|UPDATE ")/m, "additive only");
for (const v of ["PLAN_ITEM_SHARED", "PLAN_ITEM_MADE_PRIVATE", "PLAN_ITEM_RESCHEDULED"]) {
  assert.match(code, new RegExp(`ADD VALUE IF NOT EXISTS '${v}'`));
  assert.match(read("prisma/schema.prisma"), new RegExp(`^  ${v}$`, "m"));
  // Server-only: never accepted from the generic client ingestion endpoint.
  assert.match(read("src/app/api/analytics/events/route.ts"), new RegExp(`UserEventType\\.${v}`));
  assert.match(read("src/server/family/eventFamilyContext.ts"), new RegExp(`"${v}"`));
}
assert.match(code, /ADD COLUMN "updatedAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
assert.match(read("prisma/schema.prisma"), /updatedAt\s+DateTime\s+@default\(now\(\)\) @updatedAt\n\s+\/\/\/ Family Core: семья-владелец/);

const svc = read("src/server/family/planVisibility.service.ts");
assert.match(svc, /familyReadsEnabled\(\)/);
assert.match(svc, /planScopeFor\(userId\)/);
assert.match(svc, /updatedAt: item\.updatedAt/, "conditional write on the version the check saw");
assert.match(read("src/app/api/plan/items/[id]/visibility/route.ts"), /getCurrentUser/);
assert.match(read("src/server/services/plan.service.ts"), /PLAN_ITEM_RESCHEDULED/);
console.log("planVisibility.contract.test: ok");
