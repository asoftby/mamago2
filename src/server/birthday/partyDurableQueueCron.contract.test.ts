import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cron = readFileSync("src/server/birthday/partyCandidateReplenishment.service.ts", "utf8");
const legacy = readFileSync("src/server/birthday/partyCandidateDispatch.service.ts", "utf8");
for (const invariant of [
  'PARTY_CANDIDATE_AUTO_REPLENISH_ENABLED',
  'providerInvites: { some: { status: "QUEUED" } }',
  'dispatchQueuedPartyInvites(item.id)',
  'providerInvites: { none: {} }',
  'dispatchPartyCandidateWave(',
]) assert.ok(cron.includes(invariant), "Missing isolated dispatch invariant: " + invariant);
assert.ok(legacy.includes("current.providerInvites.length > 0"),
  "Legacy dispatch must reject items with durable invitation queue");
assert.ok(legacy.includes("Услуга использует очередь приглашений"));
console.log("partyDurableQueueCron.contract.test.ts: OK");
