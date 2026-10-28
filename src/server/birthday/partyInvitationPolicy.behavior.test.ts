import assert from "node:assert/strict";
import { selectPartyInvitationWave, MAX_PARTY_INVITATIONS_PER_WAVE } from "./partyInvitationPolicy";
import type { AvailablePartyCandidate } from "./partyAvailableCandidates";

const candidate = (n: number): AvailablePartyCandidate => ({
  offerId: "offer-" + n, businessId: "business-" + n,
  score: 10 - n, priceByn: 100, availability: "AVAILABLE",
});
const ranked = Array.from({ length: 9 }, (_, i) => candidate(i + 1));
const first = selectPartyInvitationWave({ ranked, invitedBusinessIds: [], activeBusinessIds: [] });
assert.equal(MAX_PARTY_INVITATIONS_PER_WAVE, 5);
assert.deepEqual(first.selected.map(c => c.businessId), ["business-1", "business-2", "business-3", "business-4", "business-5"]);
assert.equal(first.remaining.length, 4);
const replacement = selectPartyInvitationWave({
  ranked, invitedBusinessIds: ["business-1", "business-2", "business-3", "business-4", "business-5"],
  activeBusinessIds: ["business-2", "business-3", "business-4", "business-5"],
});
assert.deepEqual(replacement.selected.map(c => c.businessId), ["business-6"]);
const noCapacity = selectPartyInvitationWave({ ranked, invitedBusinessIds: [], activeBusinessIds: ranked.slice(0, 5).map(c => c.businessId) });
assert.deepEqual(noCapacity.selected, []);
const duplicates = selectPartyInvitationWave({
  ranked: [candidate(1), {...candidate(2), businessId: "business-1"}, candidate(3)],
  invitedBusinessIds: [], activeBusinessIds: [],
});
assert.deepEqual(duplicates.selected.map(c => c.businessId), ["business-1", "business-3"]);
const noRetry = selectPartyInvitationWave({ ranked, invitedBusinessIds: ["business-1"], activeBusinessIds: [], maxActive: 1 });
assert.equal(noRetry.selected[0].businessId, "business-2");
console.log("partyInvitationPolicy.behavior.test.ts: OK");
