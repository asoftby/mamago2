import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Child ownership checks go through the single scope helper, never parentId.
const childFiles = [
  "src/app/api/children/route.ts",
  "src/app/api/children/[id]/route.ts",
  "src/app/api/me/profile-state/route.ts",
  "src/app/api/public/bookings/camp-shift/prefill/route.ts",
  "src/app/(public)/me/page.tsx",
  "src/app/(public)/me/profile/page.tsx",
  "src/app/(public)/me/plan/page.tsx",
  "src/lib/decision/subjects.ts",
];
for (const f of childFiles) {
  const src = read(f);
  assert.match(src, /childScopeFor/, `${f} must use childScopeFor`);
  assert.doesNotMatch(src, /where:\s*\{[^}]*parentId:\s*(user\.id|input\.userId)/, `${f} must not authorize by parentId`);
}

// New children carry familyId and createdById.
const create = read("src/app/api/children/route.ts");
assert.match(create, /familyId,\s*\n\s*createdById: user\.id/);

// plan.service: no raw userId ownership, no cancelledAt, every create sets familyId.
const plan = read("src/server/services/plan.service.ts");
assert.doesNotMatch(plan, /cancelledAt/);
assert.equal((plan.match(/planItem\.create\(/g) ?? []).length, 4);
assert.equal((plan.match(/familyId: await familyIdForWrite\(userId\)/g) ?? []).length, 4);
assert.match(plan, /\.\.\.\(await planScopeFor\(userId\)\)/);

// Not touched in B2: delete-account stays as is (B3) and reads default to legacy.
assert.doesNotMatch(read("src/server/account/deleteAccount.service.ts"), /familyId|familyMembership|ensureFamily/);
assert.match(read("src/server/family/familyScope.ts"), /FAMILY_CORE_READS/);

// Active-state lookups (planned / in plan / dedup) must exclude CANCELLED via
// activePlanScopeFor; plain planScopeFor is reserved for ACL-only checks.
const activeStateFiles = [
  "src/server/services/plan.service.ts",
  "src/server/services/planOccurrence.service.ts",
  "src/server/services/dayScenario.service.ts",
  "src/app/api/save/status/route.ts",
  "src/app/api/save/ideas/route.ts",
  "src/app/api/plan/suggestions/route.ts",
  "src/app/api/plan/generate/route.ts",
  "src/app/(public)/me/ideas/page.tsx",
];
for (const f of activeStateFiles) {
  const src = read(f);
  assert.match(src, /activePlanScopeFor/, `${f} must use activePlanScopeFor`);
  const plainUses = (src.match(/\bplanScopeFor\(/g) ?? []).length;
  // plan.service keeps exactly one ACL-only use: removePlanItem.
  assert.equal(plainUses, f.endsWith("plan.service.ts") ? 1 : 0, `${f}: unexpected plain planScopeFor`);
}
const planSvc = read("src/server/services/plan.service.ts");
const removeBody = planSvc.slice(planSvc.indexOf("export async function removePlanItem"));
assert.match(removeBody.slice(0, removeBody.indexOf("\n}\n")), /planScopeFor\(userId\)/);
// Every dedup findFirst in plan.service goes through the active scope.
for (const m of planSvc.matchAll(/planItem\.findFirst\(\{\s*where: \{([^}]*)\}/g)) {
  assert.match(m[1], /activePlanScopeFor/, "dedup findFirst must use activePlanScopeFor");
}
// The scenario duplicate check also ignores cancelled rows.
assert.match(read("src/app/api/plan/scenario/route.ts"), /id: \{ not: replacement\.planItemId \}, \.\.\.NOT_CANCELLED/);

console.log("familyCoreReads.contract.test.ts: OK");
