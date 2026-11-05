import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import type { ActivityMock } from "@/types/activity";
import { familyFitBadgeLabel } from "@/lib/family/fitBadgeLabel";
import { getAgeFromBirthDate } from "./personaRanking";

/** The UI must never infer personal suitability from age alone. */
export function homeOfferRecommendationLabel(
  offer: Pick<ActivityMock, "agePolicy" | "ageFrom" | "ageTo">,
  personas: readonly FamilyPersona[],
  verifiedMatchedChildIds: readonly string[] = [],
): string | null {
  if (!verifiedMatchedChildIds.length || offer.agePolicy === "ADULT_ONLY" || offer.agePolicy === "UNKNOWN") return null;
  const verified = new Set(verifiedMatchedChildIds);
  const names = personas.filter(persona => {
    if (persona.kind !== "child" || !verified.has(persona.id)) return false;
    const age = getAgeFromBirthDate(persona.birthDate);
    if (age == null) return false;
    return offer.agePolicy === "UNRESTRICTED" || age >= offer.ageFrom && age <= offer.ageTo;
  }).map(persona => persona.displayName);
  return familyFitBadgeLabel({ matchedChildNames: names });
}
