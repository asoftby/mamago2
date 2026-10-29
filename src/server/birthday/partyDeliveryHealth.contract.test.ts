import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/cron/party-outbox/route.ts", "utf8");
const health = readFileSync("src/server/birthday/partyDeliveryHealth.service.ts", "utf8");

const authorized = route.indexOf("if (rejected) return rejected;");
const metrics = route.indexOf("getPartyDeliveryHealth()");
assert.ok(authorized >= 0 && metrics > authorized,
  "party delivery health must be exposed only after cron auth");
assert.ok(metrics > route.indexOf("dispatchPartyOutbox()"),
  "health must reflect the latest dispatch attempt");
for (const invariant of [
  'status: "FAILED", attempts: { gte: 5 }',
  'status: "PENDING", createdAt: { lt: staleBefore }',
  'status: "FAILED"',
  'path: ["source"], equals: "PARTY_OUTBOX"',
  'channel: { in: ["EMAIL", "TELEGRAM"] }',
]) {
  assert.ok(health.includes(invariant), "missing delivery health check: " + invariant);
}
assert.ok(!/contactPhone|customerPhone|chatId|botToken|errorMessage/.test(health),
  "health metrics must not include personal data or raw errors");
assert.ok(route.includes("deliveryHealth.requiresAttention"),
  "operator must be alerted when party deliveries require reconciliation");
console.log("partyDeliveryHealth.contract.test.ts: OK");
