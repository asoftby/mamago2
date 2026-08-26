/**
 * dashboardBlocks.ts registry tests — no DB required.
 * Run: npx tsx src/lib/admin/dashboardBlocks.test.ts
 */
import assert from "node:assert/strict";
import { ADMIN_DASHBOARD_BLOCKS, getEnabledDashboardBlocks, getDashboardBlock } from "./dashboardBlocks";

const ENABLED_IDS = [
  "operations",
  "product",
  "northStar",
  "habit",
  "funnel",
  "growth",
  "search",
  "supply",
  "b2b",
  "workload",
  "dataQuality",
] as const;
const DISABLED_IDS = ["traffic", "engagement", "finance"] as const;

function main() {
  const ids = ADMIN_DASHBOARD_BLOCKS.map((b) => b.id);
  assert.deepEqual(
    ids.slice().sort(),
    [...ENABLED_IDS, ...DISABLED_IDS].slice().sort(),
    "registry must contain exactly the expected frozen block ids",
  );

  const byId = Object.fromEntries(ADMIN_DASHBOARD_BLOCKS.map((b) => [b.id, b]));

  for (const id of ENABLED_IDS) {
    assert.equal(byId[id].enabled, true, `${id} must be enabled`);
  }
  for (const id of DISABLED_IDS) {
    assert.equal(byId[id].enabled, false, `${id} must be disabled (data source removed from the first screen, not deleted)`);
  }

  const enabled = getEnabledDashboardBlocks();
  assert.deepEqual(
    enabled.map((b) => b.id),
    [...ENABLED_IDS],
    "getEnabledDashboardBlocks must match the dashboard render order",
  );
  assert.ok(
    enabled.every((b, i) => i === 0 || enabled[i - 1].order < b.order),
    "returned blocks must be strictly ascending by order",
  );

  assert.equal(getDashboardBlock("habit").enabled, true);
  assert.equal(getDashboardBlock("traffic").enabled, false);
  assert.throws(() => getDashboardBlock("unknown" as never), "unknown id must throw, not silently return undefined");

  console.log("dashboardBlocks.test.ts: OK");
}

main();
