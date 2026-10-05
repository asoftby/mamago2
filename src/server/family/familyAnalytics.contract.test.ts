import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

for (const f of [
  "src/server/services/analytics/analyticsBehavior.service.ts",
  "src/server/services/analytics/analyticsQueryHelpers.ts",
]) {
  const src = read(f);
  assert.match(src, /youngestChildBirthByUser/, f);
  assert.doesNotMatch(src, /GROUP BY c\."parentId"/, `${f} must not group by parentId`);
}
assert.match(read("src/server/services/analytics/SegmentResolverService.ts"), /childScopeFor/);
const plan = read("src/server/services/plan.service.ts");
assert.match(plan, /planCountUnit/);
assert.match(plan, /familyAnalyticsPure/);
const helper = read("src/server/family/familyAnalytics.ts");
assert.match(helper, /familyReadsEnabled\(\)/);
assert.match(helper, /"leftAt" IS NULL/);
console.log("familyAnalytics.contract.test: ok");
