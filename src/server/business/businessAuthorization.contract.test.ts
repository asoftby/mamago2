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

test("paid promotion requires an active billing OWNER and an ACTIVE business, no platform bypass", () => {
  // Owner decision 2026-11-27 (AUDIT-XR-02): only OWNER may buy paid promotion; MANAGER keeps free Boost.
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
  for (const path of [
    "src/server/services/billing/boostPurchase.service.ts",
    "src/server/services/billing/eventBoostPurchase.service.ts",
  ]) {
    const code = source(path);
    const guard = code.indexOf("await assertPaidBoostOwnerInTx(tx,");
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
