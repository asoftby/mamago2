import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const worker = readFileSync("src/server/birthday/partyCandidateReplenishment.service.ts", "utf8");
const cron = readFileSync("src/app/api/cron/party-outbox/route.ts", "utf8");
const dispatch = readFileSync("src/server/birthday/partyCandidateDispatch.service.ts", "utf8");
assert.ok(worker.includes('PARTY_CANDIDATE_AUTO_REPLENISH_ENABLED !== "true"'));
assert.ok(worker.includes('path: ["candidateWave"], equals: true'));
assert.ok(worker.includes('confirmedBookingRequestId: null'));
assert.ok(worker.includes('status: "ANCHOR_CONFIRMED"'));
assert.ok(worker.includes('Math.min(20, limit)'));
assert.ok(worker.includes("await dispatchPartyCandidateWave"));
assert.ok(cron.indexOf("await expirePartyRequests()") <
  cron.indexOf("await replenishPartyCandidateWaves()"));
assert.ok(cron.indexOf("await replenishPartyCandidateWaves()") <
  cron.indexOf("await dispatchPartyOutbox()"));
assert.ok(dispatch.includes('"EXPIRED"].includes(current.status)'));
assert.ok(dispatch.includes("current.confirmedBookingRequestId"));
console.log("partyCandidateAutoReplenish.contract.test.ts: OK");
