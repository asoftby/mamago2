import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const health = readFileSync("src/server/birthday/partyDeliveryHealth.service.ts", "utf8");
const cron = readFileSync("src/app/api/cron/party-outbox/route.ts", "utf8");
const service = health.slice(health.indexOf("export async function reconcileStalePartyDeliveries"));
assert.ok(service.includes('status: "PENDING"'), "must only claim pending records");
assert.ok(service.includes('updatedAt: { lt: staleBefore }'), "must not claim active attempts");
assert.ok(service.includes('path: ["source"], equals: "PARTY_OUTBOX"'), "must be party scoped");
assert.ok(service.includes('channel: { in: ["EMAIL", "TELEGRAM"] }'), "must only reconcile external channels");
assert.ok(service.includes('errorMessage: "STALE_PENDING_RECONCILED"'), "must exclude auto retry");
assert.ok(!service.includes("resendNotificationDelivery("), "must never automatically resend ambiguous delivery");
assert.ok(!service.includes("dispatchDelivery("), "must not send external messages");
const authorized = cron.indexOf("if (rejected) return rejected;");
const reconciliation = cron.indexOf("reconcileStalePartyDeliveries()");
assert.ok(authorized >= 0 && reconciliation > authorized, "reconciliation must require cron authorization");
assert.ok(cron.indexOf("getPartyDeliveryHealth()") > reconciliation, "health metrics must reflect reconciliation");
console.log("partyDeliveryReconcile.contract.test.ts: OK");
