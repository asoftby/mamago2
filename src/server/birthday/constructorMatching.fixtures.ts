import type { OfferForConstructor } from "@/lib/birthday/constructorContract";
import type { ConstructorRequirements } from "./constructorMatching";
export function constructorFixture(id = "offer"): OfferForConstructor {
  const unknown = { state: "UNKNOWN" as const, reason: "NOT_PROVIDED" as const };
  return { contractVersion: 1, source: { entity: "Offer", id, revision: "fixture-version" }, offerId: id, businessId: id+"-business", productType: "PARTY_SERVICE", category: "SHOW",
    location: { meaning: "EVENT_LOCATION", mode: unknown }, occasions: unknown,
    age: { agePolicy: "UNKNOWN", ageMinMonths: null, ageMaxMonths: null },
    participants: { children: { min: null, max: null }, totalCapacity: unknown },
    interests: unknown, durationMinutes: unknown, geography: [{ kind: "UNKNOWN", reason: "NOT_PROVIDED" }],
    price: { state: "UNRESOLVED", reason: "MISSING", sources: [] }, composition: { state: "NOT_A_PACKAGE" }, availability: { state: "UNKNOWN", reason: "NO_RESOURCE" } };
}
export function requirementsFixture(): ConstructorRequirements {
  const unknown = { state: "UNKNOWN" as const, reason: "NOT_PROVIDED" as const };
  return { venueMode: "HOME", subjects: [], ageMonthsOnEventDate: unknown, interests: unknown,
    destination: unknown, guests: { children: 0, adults: 5 }, budget: unknown };
}
