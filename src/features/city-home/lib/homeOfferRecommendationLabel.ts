import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import type { ActivityMock } from "@/types/activity";
import { getAgeFromBirthDate } from "./personaRanking";

/** Labels are evidence, not a marketing claim: unknown age never means "fits". */
export function homeOfferRecommendationLabel(
  offer: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  personas: readonly FamilyPersona[],
): string | null {
  const children = personas.filter(persona => persona.kind === "child");
  const adults = personas.filter(persona => persona.kind === "adult");
  const matches = children.filter(persona => {
    const age = getAgeFromBirthDate(persona.birthDate);
    if (age == null) return false;
    if (offer.agePolicy === "ADULT_ONLY" || offer.agePolicy === "UNKNOWN") return false;
    if (offer.agePolicy === "UNRESTRICTED") return true;
    return age >= offer.ageFrom && age <= offer.ageTo;
  });
  const adultFit = offer.agePolicy === "ADULT_ONLY" || offer.agePolicy === "UNRESTRICTED"
    || (offer.agePolicy === "SPECIFIC" && offer.ageTo >= 18);
  if (matches.length && matches.length === children.length && adults.length && adultFit)
    return "Подходит всей семье";
  if (matches.length) return "Подходит: " + matches.map(persona => persona.displayName).join(", ");
  if (adults.length && adultFit) return "Подходит вам";
  return null;
}
