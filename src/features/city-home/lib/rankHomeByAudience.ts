import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { rankForFamily } from "@/lib/discovery/rankForFamily";
import { getAgeFromBirthDate } from "./personaRanking";

export type HomeAudience = {
  personas: FamilyPersona[];
  selectedPersonaIds: string[];
  manualAgeRanges?: readonly string[];
};

export type AgeBoundOffer = {
  ageFrom: number | null;
  ageTo: number | null;
  agePolicy?: string | null;
  ageTags?: readonly string[];
};

type AgeBand = { min: number; max: number };

function audienceBands(audience: HomeAudience): AgeBand[] {
  const selected = audience.personas.filter(person => audience.selectedPersonaIds.includes(person.id));
  if (selected.length === 0) return (audience.manualAgeRanges ?? []).flatMap(key => {
    const group = AGE_GROUPS.find(value => value.value === key);
    return group ? [{ min: group.min, max: group.max ?? Infinity }] : [];
  });
  return selected.flatMap(person => {
    const age = person.kind === "adult" ? 18 : getAgeFromBirthDate(person.birthDate);
    return age == null ? [] : [{ min: age, max: age }];
  });
}

function ageMatch(offer: AgeBoundOffer, bands: AgeBand[]): "match" | "unknown" | "mismatch" {
  const { ageFrom, ageTo, agePolicy, ageTags } = offer;
  if (agePolicy === "UNRESTRICTED") return "match";
  if (agePolicy === "UNKNOWN") return "unknown";
  const tagged = (ageTags ?? []).flatMap(key => {
    const group = AGE_GROUPS.find(value => value.value === key);
    return group ? [{ min: group.min, max: group.max ?? Infinity }] : [];
  });
  const offerBands = tagged.length ? tagged : ageFrom != null || ageTo != null || agePolicy === "ADULT_ONLY"
    ? [{ min: agePolicy === "ADULT_ONLY" ? 18 : ageFrom ?? 0,
      max: agePolicy === "ADULT_ONLY" ? Infinity : ageTo ?? Infinity }]
    : [];
  if (offerBands.length === 0) return "unknown";
  return offerBands.some(offerBand => bands.some(band => band.min <= offerBand.max && band.max >= offerBand.min))
    ? "match" : "mismatch";
}

/** An adult-only header intent is a strict age gate, not a soft preference. */
export function isAdultOnlyHomeAudience(audience: HomeAudience): boolean {
  const selected = audience.personas.filter(person => audience.selectedPersonaIds.includes(person.id));
  if (selected.length > 0) return selected.every(person => person.kind === "adult");
  return (audience.manualAgeRanges ?? []).length === 1 && audience.manualAgeRanges?.[0] === "18+";
}

export function homeAgeEligible<T>(items: readonly T[], audience: HomeAudience,
  getAge: (item: T) => AgeBoundOffer): T[] {
  if (!isAdultOnlyHomeAudience(audience)) return [...items];
  return items.filter(item => {
    const { ageFrom, ageTo, agePolicy, ageTags } = getAge(item);
    if (agePolicy === "ADULT_ONLY" || agePolicy === "UNRESTRICTED") return true;
    if (agePolicy === "UNKNOWN") return false;
    if ((ageTags ?? []).length > 0) return ageTags!.includes("18+");
    // An inclusive upper bound of 18 is often a child/teen bracket, not adult suitability.
    return (ageTo != null && ageTo > 18) || (ageTo == null && ageFrom != null && ageFrom >= 18);
  });
}

/** Reports no match only for an active audience and an actual nonempty candidate pool. */
export function homeAudienceMatchStatus<T>(items: readonly T[], audience: HomeAudience,
  getAge: (item: T) => AgeBoundOffer): "no-selection" | "match" | "no-match" | "no-items" {
  const eligible = homeAgeEligible(items, audience, getAge);
  if (!eligible.length) return "no-items";
  const bands = audienceBands(audience);
  if (!bands.length) return "no-selection";
  return eligible.some(item => ageMatch(getAge(item), bands) === "match") ? "match" : "no-match";
}

/** Soft ranking: matches first, unknowns neutral, mismatches below; no removal. */
export function rankHomeByAudience<T>(items: readonly T[], audience: HomeAudience,
  getAge: (item: T) => AgeBoundOffer): T[] {
  const eligible = homeAgeEligible(items, audience, getAge);
  const bands = audienceBands(audience);
  if (!bands.length) return eligible;
  return rankForFamily(eligible, (item, index) => {
    const fit = ageMatch(getAge(item), bands);
    return (fit === "match" ? 100_000 : fit === "unknown" ? 10_000 : 0) - index;
  });
}

/** A visual boundary after strongly relevant cards; right side remains age-safe. */
export function homeAudienceSections<T>(items: readonly T[], audience: HomeAudience,
  getAge: (item: T) => AgeBoundOffer): { primary: T[]; alternatives: T[]; active: boolean } {
  const ordered = rankHomeByAudience(items, audience, getAge);
  const bands = audienceBands(audience);
  if (bands.length === 0) return { primary: ordered, alternatives: [], active: false };
  const strictAdult = isAdultOnlyHomeAudience(audience);
  const primary: T[] = [];
  const alternatives: T[] = [];
  for (const item of ordered) {
    const offer = getAge(item);
    const strictAdultMatch = offer.agePolicy === "ADULT_ONLY" || (offer.ageFrom != null && offer.ageFrom >= 18);
    const verified = ageMatch(offer, bands) === "match";
    if (verified && (!strictAdult || strictAdultMatch)) primary.push(item);
    else alternatives.push(item);
  }
  return { primary, alternatives, active: true };
}
