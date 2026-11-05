import { createHash } from "node:crypto";
import { PartyCategory } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { OfferForConstructorSchema, type OfferForConstructor, type AvailabilityEvidence } from "@/lib/birthday/constructorContract";
import { checkInterestSlugs } from "@/lib/offers/offerInterests";
import { constructorBusinessSelect } from "./constructorEligibility";

export const constructorOfferSelect = {
  id: true, updatedAt: true, status: true, archivedAt: true, productType: true, category: true,
  slug: true, title: true, coverImage: true, placeId: true,
  agePolicy: true, ageMinMonths: true, ageMaxMonths: true, interestSlugs: true,
  minChildren: true, maxChildren: true, partyLocationType: true, occasions: true, details: true,
  priceMode: true, priceFrom: true, priceTo: true, currency: true,
  components: { orderBy: [{ position: "asc" }, { id: "asc" }], select: {
    id: true, title: true, category: true, refOfferId: true, isOptional: true,
  } },
  offerBooking: { select: { id: true, pricingRevision: true, basePriceByn: true,
    capacity: true, maxExtensionHours: true, extensionHourPriceByn: true } },
  place: { select: { id: true, title: true, cityId: true, territoryId: true,
    ownerBusinessId: true, ownerBusiness: { select: { ...constructorBusinessSelect, name: true } } } },
} satisfies Prisma.OfferSelect;
export type ConstructorOfferRow = Prisma.OfferGetPayload<{ select: typeof constructorOfferSelect }>;
const unknown = (reason: "NOT_PROVIDED" | "LEGACY_INCOMPLETE" | "POLICY_PENDING" = "NOT_PROVIDED") => ({ state: "UNKNOWN" as const, reason });
const known = <T>(value: T) => ({ state: "KNOWN" as const, value });
export const partyDetailsRecord = (details: unknown): Record<string, unknown> =>
  details && typeof details === "object" && !Array.isArray(details) ? details as Record<string, unknown> : {};

/** Decimal formatting only, never a price calculation or rounding policy. */
function amount(value: number | Prisma.Decimal | null): string | null {
  if (value === null) return null;
  const d = new Prisma.Decimal(value);
  if (!d.isFinite() || d.isNegative() || d.decimalPlaces() > 2 || d.greaterThan("99999999.99")) return null;
  return d.toFixed(2);
}
export function constructorPrice(row: ConstructorOfferRow): OfferForConstructor["price"] {
  const source = { entity: "Offer" as const, id: row.id, revision: row.updatedAt.toISOString() };
  const booking = row.offerBooking;
  const sources = [source, ...(booking ? [{ entity: "OfferBooking" as const, id: booking.id, revision: String(booking.pricingRevision) }] : [])];
  const unresolved = (reason: "MISSING" | "SOURCE_CONFLICT" | "UNSUPPORTED_CURRENCY" | "POLICY_PENDING") => ({ state: "UNRESOLVED" as const, reason, sources });
  if (row.currency !== "BYN") return unresolved("UNSUPPORTED_CURRENCY");
  if (row.priceMode === "ON_REQUEST") return booking?.basePriceByn != null ? unresolved("SOURCE_CONFLICT") : { state: "RESOLVED", source, price: { kind: "ON_REQUEST" } };
  if (row.priceMode === "UNKNOWN" || row.priceMode === "NONE") return unresolved("MISSING");
  if (row.priceMode === "RANGE") return unresolved("POLICY_PENDING");
  const value = row.priceMode === "FREE" ? "0.00" : amount(row.priceFrom);
  if (value === null) return unresolved("MISSING");
  if (booking?.basePriceByn != null && amount(booking.basePriceByn) !== value) return unresolved("SOURCE_CONFLICT");
  if (booking && (booking.maxExtensionHours > 0 || booking.extensionHourPriceByn != null)) return unresolved("POLICY_PENDING");
  if (!["EXACT", "FREE", "FROM"].includes(row.priceMode)) return unresolved("POLICY_PENDING");
  return { state: "RESOLVED", source, price: row.priceMode === "FROM" ? { kind: "FROM", minimumByn: value } : { kind: "EXACT", amountByn: value } };
}

/** A3 read adapter. Unscoped hidden category data is never treated as universal evidence. */
export function toConstructorOffer(row: ConstructorOfferRow, availability: AvailabilityEvidence = { state: "UNKNOWN", reason: "NO_EXACT_TIME" }): OfferForConstructor {
  const d = partyDetailsRecord(row.details);
  const source = { entity: "Offer" as const, id: row.id, revision: row.updatedAt.toISOString() };
  const fulfilment = row.productType === "PARTY_SERVICE" && ["CAKE", "FOOD", "DECOR"].includes(row.category ?? "");
  const atPlace = row.place?.territoryId && row.placeId && (row.partyLocationType === "ON_SITE" || row.partyLocationType === "BOTH");
  // No structured travel/delivery zone exists in A2. Never parse serviceAreaText or infer one from a business address.
  const geography: OfferForConstructor["geography"] = [
    ...(atPlace ? [{ kind: "AT_PLACE" as const, placeId: row.placeId!, territoryId: row.place!.territoryId! }] : []),
    ...(!atPlace || row.partyLocationType !== "ON_SITE" ? [{ kind: "UNKNOWN" as const, reason: "NOT_PROVIDED" as const }] : []),
  ];
  const compositionRevision = source.revision + ":" + createHash("sha256").update(JSON.stringify(row.components)).digest("hex");
  const dto = {
    contractVersion: 1 as const, source, offerId: row.id, businessId: row.place?.ownerBusinessId ?? "",
    productType: row.productType, category: row.category,
    performerRole: row.category === "ANIMATOR" && (d.performerRole === "ANIMATOR" || d.performerRole === "HOST") ? known(d.performerRole) : unknown(),
    location: { mode: row.partyLocationType ? known(row.partyLocationType) : unknown(), meaning: fulfilment ? "FULFILMENT" as const : "EVENT_LOCATION" as const },
    occasions: row.occasions.length ? known(row.occasions) : unknown(),
    age: { agePolicy: row.agePolicy, ageMinMonths: row.ageMinMonths, ageMaxMonths: row.ageMaxMonths },
    participants: { children: { min: row.minChildren, max: row.maxChildren }, totalCapacity: row.offerBooking?.capacity != null ? known(row.offerBooking.capacity) : unknown() },
    interests: checkInterestSlugs(row.interestSlugs).ok ? known(row.interestSlugs) : unknown("LEGACY_INCOMPLETE"),
    geography,
    durationMinutes: Number.isInteger(d.durationMinutes) && Number(d.durationMinutes) > 0 ? known(Number(d.durationMinutes)) : unknown(),
    price: constructorPrice(row),
    composition: row.productType !== "PARTY_PACKAGE" ? { state: "NOT_A_PACKAGE" as const } : row.components.length ? {
      state: "COMPONENTS" as const, components: row.components.map(c => ({ componentId: c.id,
        source: { entity: "PackageComponent" as const, id: c.id, revision: compositionRevision },
        category: c.category, title: c.title, refOfferId: c.refOfferId, legacyIsOptional: c.isOptional,
        removable: unknown("POLICY_PENDING"), removalPriceRule: { state: "POLICY_PENDING" as const },
      })),
    } : { state: "LEGACY_CATEGORY_COVERAGE" as const, categories: Array.isArray(d.includedCategories) ? d.includedCategories.filter((v): v is PartyCategory => typeof v === "string" && Object.values(PartyCategory).includes(v as PartyCategory)) : [], source },
    availability,
  };
  return OfferForConstructorSchema.parse(dto);
}
