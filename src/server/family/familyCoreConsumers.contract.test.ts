import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Family Core M1a: per-user plan consumers go through the family scope helpers.
const exp = read("src/server/services/experience/experience.service.ts");
assert.match(exp, /planScopeFor/);
assert.match(exp, /activePlanScopeFor/);
assert.match(exp, /activeFamilyUserIds/);
assert.doesNotMatch(exp, /planItem\.findFirst\(\{\s*where:\s*\{\s*id: input\.planItemId,\s*userId/);
assert.doesNotMatch(exp, /planItem\.findMany\(\{\s*where:\s*\{[^}]*userId: input\.userId/);

const route = read("src/app/api/plan/scenario/route.ts");
assert.match(route, /activePlanScopeFor/);
assert.match(route, /planScopeFor/);
assert.doesNotMatch(route, /planItem\.(findMany|findFirst|deleteMany)\(\{\s*where:\s*\{\s*userId/);

const scenario = read("src/server/services/dayScenario.service.ts");
assert.match(scenario, /where: \{ id: planItemId, \.\.\.\(await planScopeFor\(userId\)\), date \}/);

const plan = read("src/server/services/plan.service.ts");
assert.match(plan, /fanOutItemsToFamilyMembers/);
assert.match(plan, /fanOutItemsToDigestTargets/);

console.log("familyCoreConsumers.contract: ok");
