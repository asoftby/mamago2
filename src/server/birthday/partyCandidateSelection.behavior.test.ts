import assert from "node:assert/strict";
import { selectCheckedPartyCandidates } from "./partyCandidateSelection";
import type { RankedPartyCandidate } from "./partyCandidateRanking";

const candidate = (n: number): RankedPartyCandidate => ({
  offerId: "o" + n, businessId: "b" + n, priceByn: 100, score: 100 - n,
});
const checks = [
  { candidate: candidate(1), availability: "UNAVAILABLE" as const },
  { candidate: candidate(2), availability: "UNKNOWN" as const },
  { candidate: candidate(3), availability: "AVAILABLE" as const },
  { candidate: candidate(4), availability: "AVAILABLE" as const },
  { candidate: candidate(5), availability: "UNAVAILABLE" as const },
  { candidate: candidate(6), availability: "AVAILABLE" as const },
];
assert.deepEqual(selectCheckedPartyCandidates(checks).map(c => c.offerId), ["o3", "o4", "o6", "o2"]);
assert.deepEqual(selectCheckedPartyCandidates(checks, 2).map(c => c.offerId), ["o3", "o4"]);
assert.deepEqual(selectCheckedPartyCandidates([{ candidate: candidate(1), availability: "UNKNOWN" }]),
  [{ ...candidate(1), availability: "UNKNOWN" }]);
assert.deepEqual(selectCheckedPartyCandidates([{ candidate: candidate(1), availability: "UNAVAILABLE" }]), []);
console.log("partyCandidateSelection.behavior.test.ts: OK");
