import type { AvailablePartyCandidate } from "./partyAvailableCandidates";

export const MAX_PARTY_INVITATIONS_PER_WAVE = 5;

export type PartyInvitationDecision = {
  selected: AvailablePartyCandidate[];
  remaining: AvailablePartyCandidate[];
};

/**
 * Pure admission policy, not a dispatcher.
 *
 * Active invitations occupy slots. Previously invited businesses are never
 * invited twice, even after a refusal/timeout. Only AVAILABLE / UNKNOWN
 * candidates can be considered, with AVAILABLE ranked first upstream.
 */
export function selectPartyInvitationWave(input: {
  ranked: readonly AvailablePartyCandidate[];
  invitedBusinessIds: readonly string[];
  activeBusinessIds: readonly string[];
  maxActive?: number;
}): PartyInvitationDecision {
  const maxActive = Math.min(MAX_PARTY_INVITATIONS_PER_WAVE,
    Math.max(0, Math.floor(input.maxActive ?? MAX_PARTY_INVITATIONS_PER_WAVE)));
  const invited = new Set(input.invitedBusinessIds);
  const active = new Set(input.activeBusinessIds);
  const capacity = Math.max(0, maxActive - active.size);
  const unique = new Set<string>();
  const eligible: AvailablePartyCandidate[] = [];
  for (const candidate of input.ranked) {
    if (invited.has(candidate.businessId) || active.has(candidate.businessId) ||
      unique.has(candidate.businessId)) continue;
    unique.add(candidate.businessId);
    eligible.push(candidate);
  }
  return { selected: eligible.slice(0, capacity), remaining: eligible.slice(capacity) };
}
