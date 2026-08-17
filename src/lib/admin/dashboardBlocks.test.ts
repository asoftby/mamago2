/**
 * dashboardBlocks.ts registry tests — no DB required.
 * Run: npx tsx src/lib/admin/dashboardBlocks.test.ts
 */
import assert from "node:assert/strict";
import { ADMIN_DASHBOARD_BLOCKS, getEnabledDashboardBlocks, getDashboardBlock } from "./dashboardBlocks";

function main() {
  const ids = ADMIN_DASHBOARD_BLOCKS.map((b) => b.id);
  assert.deepEqual(
    ids,
    ["operations", "traffic", "product", "engagement", "search", "workload", "retention", "finance"],
    "exact 8 frozen block ids, in registry order",
  );

  const byId = Object.fromEntries(ADMIN_DASHBOARD_BLOCKS.map((b) => [b.id, b]));
  assert.equal(byId.operations.order, 10);
  assert.equal(byId.traffic.order, 20);
  assert.equal(byId.product.order, 30);
  assert.equal(byId.engagement.order, 40);
  assert.equal(byId.search.order, 50);
  assert.equal(byId.workload.order, 60);
  assert.equal(byId.retention.order, 70);
  assert.equal(byId.finance.order, 80);

  for (const id of ["operations", "traffic", "product", "engagement", "search", "workload"] as const) {
    assert.equal(byId[id].enabled, true, `${id} must be enabled`);
  }
  assert.equal(byId.retention.enabled, false, "retention must be disabled");
  assert.equal(byId.finance.enabled, false, "finance must be disabled");

  assert.equal(byId.operations.size, "wide", "operations must be the sole wide block");
  for (const id of ["traffic", "product", "engagement", "search", "workload", "retention", "finance"] as const) {
    assert.equal(byId[id].size, "medium", `${id} must be medium`);
  }

  const enabled = getEnabledDashboardBlocks();
  assert.deepEqual(
    enabled.map((b) => b.id),
    ["operations", "traffic", "product", "engagement", "search", "workload"],
    "getEnabledDashboardBlocks must return exactly the 6 enabled blocks, sorted by order",
  );
  assert.ok(
    enabled.every((b, i) => i === 0 || enabled[i - 1].order < b.order),
    "returned blocks must be strictly ascending by order",
  );

  assert.equal(getDashboardBlock("retention").enabled, false);
  assert.throws(() => getDashboardBlock("unknown" as never), "unknown id must throw, not silently return undefined");

  console.log("dashboardBlocks.test.ts: OK");
}

main();
