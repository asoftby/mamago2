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

test("paid promotion requires active OWNER or MANAGER membership and an ACTIVE business, no platform bypass", () => {
  // Latest policy: both OWNER and MANAGER may purchase; billing statement access remains OWNER-only.
  for (const path of [
    "src/app/business/(protected)/offers/[id]/boost/actions.ts",
    "src/app/business/(protected)/events/[id]/boost/actions.ts",
    "src/app/business/(protected)/promotion/actions.ts",
  ]) {
    const code = source(path);
    assert.match(code, /getCurrentUser\(\)/, path);
    assert.match(code, /getMyBusiness\(user\.id\)/, path);
    assert.match(code, /business\.operationalStatus !== "ACTIVE" \|\| !\(await canPurchasePaidBoost\(user\.id, business\.id\)\)/, path);
    assert.doesNotMatch(code, /getBusinessMembership\(/, path);
  }
  const authorization = source("src/server/services/billing/paidBoostAuthorization.ts");
  assert.match(authorization, /operationalStatus: "ACTIVE"/);
  assert.match(authorization, /role: \{ in: \["OWNER", "MANAGER"\] \}/);
  assert.match(authorization, /isActive: true/);
  assert.doesNotMatch(authorization, /ownerUserId:/);
  assert.match(authorization, /id: businessId/);
  for (const path of [
    "src/server/services/billing/boostPurchase.service.ts",
    "src/server/services/billing/eventBoostPurchase.service.ts",
  ]) {
    const code = source(path);
    const guard = code.indexOf("await assertPaidBoostPurchaserInTx(tx,");
    assert.ok(guard > 0, path);
    assert.ok(guard < code.indexOf("purchaseRequestKey: params.requestKey"), `${path}: guard must precede replay lookup`);
  }
  assert.match(source("src/app/business/(protected)/offers/[id]/boost/actions.ts"), /actorUserId: user\.id/);
  assert.match(source("src/app/business/(protected)/events/[id]/boost/actions.ts"), /ownerUserId: user\.id/);
  for (const path of [
    "src/app/business/(protected)/offers/[id]/boost/page.tsx",
    "src/app/business/(protected)/events/[id]/boost/page.tsx",
  ]) {
    assert.match(source(path), /canPurchasePaidBoost\(user\.id, business\.id\)/, path);
  }
  const free = source("src/app/business/(protected)/dashboard/actions.ts");
  assert.match(free, /getMyBusiness\(user\.id\)/);
  assert.doesNotMatch(free, /PaidBoost/);
});
