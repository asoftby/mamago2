import assert from "node:assert/strict";
import type { MetricCollectorContext } from "../types";
import { collectPartyDeliveryMetrics, partyDeliverySamples, partyDeliveryMetricsCollector } from "./partyDelivery";

assert.deepEqual(partyDeliverySamples(2, {
  failed_telegram: 3n,
  stale_pending_telegram: 1n,
}), [
  { metric: "party.outbox_failed_exhausted", value: 2 },
  { metric: "party.telegram_delivery_failed", value: 3 },
  { metric: "party.telegram_pending_stale", value: 1 },
]);
assert.deepEqual(partyDeliverySamples(0, undefined), [
  { metric: "party.outbox_failed_exhausted", value: 0 },
  { metric: "party.telegram_delivery_failed", value: 0 },
  { metric: "party.telegram_pending_stale", value: 0 },
]);

void (async () => {
  let observedWhere: unknown;
  let queries = 0;
  const now = new Date("2026-10-31T12:00:00Z");
  const prisma = {
    partyOutbox: {
      count: async (args: { where: unknown }) => { observedWhere = args.where; return 4; },
    },
    $queryRaw: async () => { queries += 1; return [{ failed_telegram: 2n, stale_pending_telegram: 3n }]; },
  };
  const actual = await collectPartyDeliveryMetrics({ prisma, now } as unknown as MetricCollectorContext);
  assert.deepEqual(observedWhere, { status: "FAILED", attempts: { gte: 5 } });
  assert.equal(queries, 1);
  assert.deepEqual(actual, [
    { metric: "party.outbox_failed_exhausted", value: 4 },
    { metric: "party.telegram_delivery_failed", value: 2 },
    { metric: "party.telegram_pending_stale", value: 3 },
  ]);
  assert.equal(partyDeliveryMetricsCollector.intervalSec, 300);
  assert.ok(actual.every(s => Object.keys(s).every(k => ["metric", "value"].includes(k))));
  console.log("partyDelivery.test.ts: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
