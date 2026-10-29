import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const behavior = read("src/server/services/analytics/analyticsBehavior.service.ts");
assert.match(behavior, /youngestChildBandByUser/, "behavior must use shared youngest-child age aggregation");
const helpers = read("src/server/services/analytics/analyticsQueryHelpers.ts");
assert.match(helpers, /youngestChildBirthByUser/, "query helpers must resolve youngest child's birth date");
for (const [file, src] of [
  ["analyticsBehavior.service.ts", behavior],
  ["analyticsQueryHelpers.ts", helpers],
]) {
  assert.doesNotMatch(src, /GROUP BY c\."parentId"/, `${file} must not group by parentId`);
}
assert.match(read("src/server/services/analytics/SegmentResolverService.ts"), /childScopeFor/);
const plan = read("src/server/services/plan.service.ts");
// Counts now aggregate in SQL; verify the family-aware query is wired in and
// keeps the same family-or-owner unit instead of requiring the old JS import.
assert.match(plan, /planActivityCountsQuery\(activityIds, familyReadsEnabled\(\)\)/);
const countsQuery = read("src/server/services/planActivityCountsQuery.ts");
assert.match(countsQuery, /COUNT\(DISTINCT/);
assert.match(countsQuery, /CASE WHEN "familyId" IS NOT NULL THEN 'f:' \|\| "familyId" ELSE 'u:' \|\| "userId" END/);
assert.match(countsQuery, /"status" <> 'CANCELLED'/);
const helper = read("src/server/family/familyAnalytics.ts");
assert.match(helper, /familyReadsEnabled\(\)/);
assert.match(helper, /"leftAt" IS NULL/);
console.log("familyAnalytics.contract.test: ok");
