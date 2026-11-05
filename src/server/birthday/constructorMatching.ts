import { birthdayAgeCompatibility, birthdayParticipantsCompatibility, birthdayLocationCompatibility, BIRTHDAY_MATCHING_CONFIG } from "@/lib/birthday/compatibility";
import type { PartyCategory } from "@prisma/client";
import type { z } from "zod";
import type { ConstraintAssessmentSchema, OfferForConstructor, PartySelectionContext } from "@/lib/birthday/constructorContract";
import { rankForFamily } from "@/lib/discovery/rankForFamily";
import { profileInterestScoreFromSlugs } from "@/server/services/recommendations/rankingSignals";

type Assessment = z.infer<typeof ConstraintAssessmentSchema>;
export type ConstructorRequirements = Pick<PartySelectionContext, "venueMode" | "subjects" | "ageMonthsOnEventDate" | "interests" | "destination" | "guests" | "budget"> & {
  category?: PartyCategory; performerRole?: "HOST" | "ANIMATOR";
  /** Legacy whole-year orders are ranges, never invented exact ages. */
  ageRangeMonths?: { min: number; max: number };
};
const soft = new Set<Assessment["dimension"]>(["BUDGET", "INTERESTS", "MAMAGO_RATING"]);
const assessment = (dimension: Assessment["dimension"], outcome: Assessment["outcome"], reasonCode: string): Assessment => ({ dimension, strength: soft.has(dimension) ? "SOFT" : "HARD", outcome, reasonCode });

export function assessConstructorOffer(offer: OfferForConstructor, q: ConstructorRequirements) {
  const facts: Assessment[] = [];
  const add = (dimension: Assessment["dimension"], outcome: Assessment["outcome"], code: string) => facts.push(assessment(dimension,outcome,code));
  const age = q.ageMonthsOnEventDate.state === "KNOWN" ? { min: q.ageMonthsOnEventDate.value, max: q.ageMonthsOnEventDate.value } : q.ageRangeMonths;
  const adults = q.subjects.length > 0 && q.subjects.every(s => s.kind === "adult");
  const child = q.subjects.some(s => s.kind === "child");
  add("AGE",birthdayAgeCompatibility(offer.age,age,adults ? "ADULT" : child ? "CHILD" : "UNKNOWN"),"CANONICAL_AGE_POLICY");
  const limits = offer.participants.children;
  add("PARTICIPANTS",birthdayParticipantsCompatibility({ minChildren: limits.min, maxChildren: limits.max,
    totalCapacity: offer.participants.totalCapacity.state === "KNOWN" ? offer.participants.totalCapacity.value : null },
    { childrenMin: q.guests.children, childrenMax: q.guests.children, total: q.guests.children + q.guests.adults }),"PARTICIPANT_LIMITS");
  add("FORMAT",birthdayLocationCompatibility({ productType: offer.productType, category: offer.category, locationType: offer.location.mode.state === "KNOWN" ? offer.location.mode.value : null },q.venueMode),"SERVICE_LOCATION_MODE");
  // Category-specific metadata from an old category cannot constrain the new one.
  if (q.category && offer.category !== q.category) add("FORMAT","MISMATCH","CATEGORY_MISMATCH");
  if (q.performerRole) add("FORMAT", offer.category !== "ANIMATOR" ? "MISMATCH" : offer.performerRole?.state !== "KNOWN" ? "UNKNOWN" : offer.performerRole.value === q.performerRole ? "MATCH" : "MISMATCH", "PERFORMER_ROLE");
  add("GEOGRAPHY", assessConstructorGeography(offer,q.destination,q.venueMode), "SERVICE_GEOGRAPHY");
  add("AVAILABILITY", offer.availability.state === "UNAVAILABLE" ? "MISMATCH" : offer.availability.state === "AVAILABLE" ? "MATCH" : "UNKNOWN", offer.availability.state);
  let budgetFit: "WITHIN" | "SOFT_OVERRUN" | "OUTSIDE_RANGE" | "UNKNOWN" = "UNKNOWN";
  if (q.budget.state === "KNOWN" && offer.price.state === "RESOLVED" && offer.price.price.kind !== "ON_REQUEST") {
    const value = BigInt((offer.price.price.kind === "EXACT" ? offer.price.price.amountByn : offer.price.price.minimumByn).replace(".",""));
    const max = q.budget.value.maximumByn, min = q.budget.value.minimumByn;
    if (min !== null && value < BigInt(min.replace(".",""))) budgetFit = "OUTSIDE_RANGE";
    else if (max === null) budgetFit = "WITHIN";
    else { const ceiling = BigInt(max.replace(".","")); budgetFit = value <= ceiling ? "WITHIN" : value * BigInt(100) <= ceiling * BigInt(100 + BIRTHDAY_MATCHING_CONFIG.budgetSoftOverrunPct) ? "SOFT_OVERRUN" : "OUTSIDE_RANGE"; }
  }
  add("BUDGET", budgetFit === "UNKNOWN" ? "UNKNOWN" : budgetFit === "WITHIN" ? "MATCH" : "MISMATCH", budgetFit);
  const interest = q.interests.state === "KNOWN" && offer.interests.state === "KNOWN" ? profileInterestScoreFromSlugs(q.interests.value,offer.interests.value) : { interestMatchCount: 0, interestBoost: 0 };
  add("INTERESTS", interest.interestMatchCount ? "MATCH" : q.interests.state === "KNOWN" && q.interests.value.length > 0 && offer.interests.state === "KNOWN" && offer.interests.value.length > 0 ? "MISMATCH" : "UNKNOWN", interest.interestMatchCount ? "SYSTEM_INTEREST_MATCH" : "NO_INTEREST_SIGNAL");
  add("MAMAGO_RATING","UNKNOWN","RATING_PROJECTION_PENDING");
  return { eligible: !facts.some(f => f.strength === "HARD" && f.outcome === "MISMATCH"), assessments: facts, budgetFit, ...interest };
}

export function assessConstructorGeography(offer: OfferForConstructor, destination: ConstructorRequirements["destination"], venueMode: ConstructorRequirements["venueMode"]): Assessment["outcome"] {
  if (destination.state !== "KNOWN") return "UNKNOWN";
  const target = destination.value;
  const mobile = offer.location.mode.state === "KNOWN" && offer.location.mode.value === "OFF_SITE" ||
    offer.location.meaning === "EVENT_LOCATION" && (venueMode === "HOME" || venueMode === "OUTDOOR");
  const purpose = offer.location.meaning === "FULFILMENT" ? "DELIVERY" : "TRAVEL";
  const applicable = offer.geography.filter(g => (g.kind !== "SERVICE_AREA" || g.purpose === purpose) && (!mobile || g.kind !== "AT_PLACE"));
  if (applicable.some(g => g.kind === "SERVICE_AREA" && g.territoryIds.includes(target.territoryId) || g.kind === "AT_PLACE" && g.territoryId === target.territoryId && (target.placeId === null || target.placeId === g.placeId))) return "MATCH";
  if (!applicable.length || applicable.some(g => g.kind === "UNKNOWN")) return "UNKNOWN";
  return "MISMATCH";
}

export type AssessedConstructorOffer = { offer: OfferForConstructor } & ReturnType<typeof assessConstructorOffer>;
/** Shared family signal first; soft constraints never change membership. No Boost/rating substitution. */
export function rankConstructorOffers(candidates: readonly AssessedConstructorOffer[]): AssessedConstructorOffer[] {
  const availability = { AVAILABLE: 0, PARTIAL: 1, UNKNOWN: 2, UNAVAILABLE: 3 };
  const budget = { WITHIN: 0, SOFT_OVERRUN: 1, UNKNOWN: 2, OUTSIDE_RANGE: 3 };
  const base = candidates.filter(c => c.eligible).sort((a,b) => availability[a.offer.availability.state] - availability[b.offer.availability.state] ||
    budget[a.budgetFit] - budget[b.budgetFit] || a.offer.businessId.localeCompare(b.offer.businessId) || a.offer.offerId.localeCompare(b.offer.offerId));
  return rankForFamily(base, c => c.interestBoost);
}
