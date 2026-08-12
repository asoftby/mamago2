import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeFinancialAmount } from "./money";

const repoRoot = process.cwd();
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

test("all admin money-write routes require ADMIN", () => {
  for (const route of ["credit", "debit", "refund"]) {
    const source = read(`src/app/api/admin/billing/${route}/route.ts`);
    assert.match(source, /user\.role !== "ADMIN"/);
  }
});

test("live booking/application code does not invoke lead debit", () => {
  const paths = [
    "src/server/services/booking/booking.service.ts",
    "src/app/api/public/bookings/route.ts",
  ];
  for (const path of paths) {
    assert.doesNotMatch(read(path), /debitLeadChargeForBookingRequest|LEAD_CHARGE/);
  }
});

test("Boost action accepts option ID, target and request key but no client price", () => {
  const source = read("src/app/business/(protected)/offers/[id]/boost/actions.ts");
  assert.match(source, /optionId/);
  assert.match(source, /requestKey/);
  assert.doesNotMatch(source, /price:\s*z\./);
});

test("money boundary rejects zero, negative and sub-cent values", () => {
  assert.throws(() => normalizeFinancialAmount(0));
  assert.throws(() => normalizeFinancialAmount(-1));
  assert.throws(() => normalizeFinancialAmount("0.001"));
  assert.equal(normalizeFinancialAmount("10.20").toFixed(2), "10.20");
});
