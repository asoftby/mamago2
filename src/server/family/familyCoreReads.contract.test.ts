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

console.log("familyCoreReads.contract.test.ts: OK");
