import "server-only";
import { previewPartyOfferAvailability } from "./partyAvailabilityPreview.service";
import { rankPartyCandidates, type PartyCandidateQuery } from "./partyCandidateRanking";
import { selectCheckedPartyCandidates, type CheckedPartyCandidate, type CandidateAvailability } from "./partyCandidateSelection";

export type AvailablePartyCandidate = CheckedPartyCandidate;

export type PartyAvailableCandidateQuery = PartyCandidateQuery & {
  date: string;
  timeFrom: string;
  timeTo: string;
  adultsCount: number;
};

/**
 * Check availability across the ranked pool, not just the first five.
 * Small batches cap concurrent DB work. Explicitly unavailable offers are
 * excluded. Unknown availability is a fallback, never marked as confirmed.
 * Informational only: booking confirmation still uses transactional locking.
 */
export async function findAvailablePartyCandidates(
  input: PartyAvailableCandidateQuery,
): Promise<AvailablePartyCandidate[]> {
  const parsedDate = new Date(input.date + "T00:00:00.000Z");
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.date ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeFrom) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeTo) ||
      input.timeTo <= input.timeFrom ||
      !Number.isInteger(input.adultsCount) || input.adultsCount < 0 || input.adultsCount > 500) return [];

  const candidates = await rankPartyCandidates({ ...input, includeAllRanked: true });
  const checked: { candidate: (typeof candidates)[number]; availability: CandidateAvailability }[] = [];
  const availableBusinesses = new Set<string>();
  // Use small, bounded bursts instead of one database fan-out for the entire city.
  for (let start = 0; start < candidates.length; start += 5) {
    const batch = candidates.slice(start, start + 5);
    const states = await Promise.all(batch.map(async (candidate) => {
      try {
        return (await previewPartyOfferAvailability({
          offerId: candidate.offerId, date: input.date,
          timeFrom: input.timeFrom, timeTo: input.timeTo,
          childrenCount: input.childrenCount, adultsCount: input.adultsCount,
        })).availability;
      } catch {
        return "UNKNOWN" as const;
      }
    }));
    batch.forEach((candidate, index) => {
      const availability = states[index];
      if (availability === "AVAILABLE") availableBusinesses.add(candidate.businessId);
      checked.push({ candidate, availability });
    });
    if (availableBusinesses.size >= 5) break;
  }
  return selectCheckedPartyCandidates(checked);
}
