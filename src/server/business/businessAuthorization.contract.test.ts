import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("business identity helpers are not Server Actions", () => {
  const code = source("src/server/business/getMyBusiness.ts");
  assert.match(code, /import ["']server-only["']/);
  assert.doesNotMatch(code, /["']use server["']/);
});

test("billing entry points require active owner membership", () => {
  for (const path of [
    "src/app/api/business/billing/route.ts",
    "src/app/api/business/billing/transactions/route.ts",
    "src/app/business/(protected)/billing/page.tsx",
    "src/app/business/(protected)/billing/documents/page.tsx",
  ]) {
    const code = source(path);
    assert.match(code, /ownerUserId: user\.id, members: \{ some: \{ userId: user\.id, isActive: true, role: "OWNER" \} \}/, path);
  }
});

test("paid promotion allows active OWNER and MANAGER membership without platform bypass", () => {
  const permissions = source("src/server/permissions/business-permissions.ts");
  const membership = permissions.split("export async function getBusinessMembership(")[1].split("export async function")[0];
  assert.match(membership, /userId,\s*businessId,\s*isActive: true/);
  assert.match(membership, /BusinessMemberRole\.OWNER, BusinessMemberRole\.MANAGER/);
  for (const path of [
    "src/app/business/(protected)/offers/[id]/boost/actions.ts",
    "src/app/business/(protected)/promotion/actions.ts",
  ]) {
    const code = source(path);
    assert.match(code, /getCurrentUser\(\)/);
    assert.match(code, /getMyBusiness\(user\.id\)/);
    assert.match(code, /business\.operationalStatus !== "ACTIVE" \|\| !\(await getBusinessMembership\(user\.id, business\.id\)\)/);
  }
});
