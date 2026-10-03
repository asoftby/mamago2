import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const sql = read("prisma/migrations/20261003130000_plan_item_nullable_date/migration.sql");
assert.match(sql, /ALTER TABLE "PlanItem" ALTER COLUMN "date" DROP NOT NULL/);
assert.doesNotMatch(sql, /UPDATE\s+"PlanItem"/i);
assert.doesNotMatch(sql, /DEFAULT/i);

const schema = read("prisma/schema.prisma");
const model = schema.match(/model PlanItem \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.match(model, /\n\s+date\s+String\?\s/);
// Experience.plannedDate stays required: an attended outcome always has a date.
const experience = schema.match(/model Experience \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.match(experience, /plannedDate\s+String\s/);

// Lists without a date constraint must filter NULL dates explicitly.
const plan = read("src/server/services/plan.service.ts");
assert.match(plan, /const DATED = \{ date: \{ not: null \} \} as const;/);
for (const fn of ["listAllPlanItems", "listArticlePlanItemsBatch", "listPlanItemsDueForReminder"]) {
  const body = plan.slice(plan.indexOf(`export async function ${fn}`));
  assert.match(body.slice(0, body.indexOf("\n}\n")), /DATED/, `${fn} must filter undated rows`);
}

console.log("planItemNullableDateMigration.contract.test.ts: OK");
