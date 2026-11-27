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


test("paid Boost must be owner-only on server and in purchase UI", () => {
  const guard = source("src/server/business/paidBoostAuthorization.ts");
  assert.match(guard, /import ["']server-only["']/);
  for (const fragment of ['userId', 'businessId', 'isActive: true', 'role: "OWNER"']) {
    assert.ok(guard.includes(fragment), fragment);
  }

  const action = source("src/app/business/(protected)/offers/[id]/boost/actions.ts");
  assert.match(action, /hasActiveBusinessOwnerMembership\(user\.id, business\.id\)/);
  assert.ok(
    action.indexOf("hasActiveBusinessOwnerMembership(user.id, business.id)") <
    action.indexOf("purchaseOfferBoost({"),
    "Owner guard must precede any charge, including idempotent replay",
  );

  const page = source("src/app/business/(protected)/offers/[id]/boost/page.tsx");
  assert.match(page, /hasActiveBusinessOwnerMembership\(user\.id, business\.id\)/);
  assert.match(page, /!canPurchasePaidBoost/);

  // Free daily Boost is a separate workflow; this policy must not restrict it.
  const freeAction = source("src/app/business/(protected)/dashboard/actions.ts");
  assert.match(freeAction, /createDailyFreeBoost\(/);
});
