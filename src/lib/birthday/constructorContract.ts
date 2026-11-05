import { z } from "zod";
import { AgePolicy, PartyCategory, PartyItemRole, PartyLocationType, PartyOccasion, PartyOrderEntry, PartyVenueMode } from "@prisma/client";
import { normalizeAgePolicy } from "@/lib/age/agePolicy";
import { ProfileInterestsConstraintSchema, SubjectSchema } from "@/lib/decision/decisionContext";
import { checkInterestSlugs } from "@/lib/offers/offerInterests";

/** A1 declarations only. No adapter, pricing/ranking engine, route or persistence writes. */
export const BIRTHDAY_CONTRACT_VERSION = 1 as const;
const id = z.string().trim().min(1);
const instant = z.iso.datetime(); // UTC Z, not a local clock or a date-only value.
const count = z.number().int().nonnegative();
export const BynAmountSchema = z.string().regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/);

/** UNKNOWN never means false, zero, unrestricted or available. */
export function knownOrUnknown<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("state", [
    z.object({ state: z.literal("KNOWN"), value }).strict(),
    z.object({ state: z.literal("UNKNOWN"), reason: z.enum([
      "NOT_PROVIDED", "LEGACY_INCOMPLETE", "SOURCE_CONFLICT", "POLICY_PENDING",
    ]) }).strict(),
  ]);
}

/** Source revision is an opaque version/timestamp supplied by the owning service. */
export const SourceRefSchema = z.object({
  entity: z.enum(["Offer", "OfferBooking", "PackageComponent", "BookingUnit", "PartyQuote"]),
  id, revision: id,
}).strict();

export const ServiceIntervalSchema = z.object({ startAt: instant, endAt: instant }).strict()
  .refine(v => Date.parse(v.startAt) < Date.parse(v.endAt), "Interval must be nonempty [start,end)");

export const ResourceWindowSchema = z.object({
  bookingUnitId: id, service: ServiceIntervalSchema, occupied: ServiceIntervalSchema,
  prepMinutes: count, cleanupMinutes: count,
}).strict().refine(v =>
  Date.parse(v.occupied.startAt) === Date.parse(v.service.startAt) - v.prepMinutes * 60_000 &&
  Date.parse(v.occupied.endAt) === Date.parse(v.service.endAt) + v.cleanupMinutes * 60_000,
"Occupied interval must include the exact resource buffers");

export const AgeRestrictionSchema = z.object({
  agePolicy: z.enum(AgePolicy), ageMinMonths: count.nullable(), ageMaxMonths: count.nullable(),
}).strict().superRefine((v, ctx) => {
  try { normalizeAgePolicy(v); }
  catch { ctx.addIssue({ code: "custom", message: "Contradictory age policy or range" }); }
});

const participantLimits = z.object({ min: count.nullable(), max: count.nullable() }).strict()
  .refine(v => v.min === null || v.max === null || v.min <= v.max, "Inverted participant limits");
const interests = z.array(z.string()).superRefine((v, ctx) => {
  if (!checkInterestSlugs(v).ok || new Set(v).size !== v.length)
    ctx.addIssue({ code: "custom", message: "Use unique canonical offer interest slugs" });
});

/** Zone IDs reference Territory. Place territory does not imply a travel/delivery zone. */
export const ServiceGeographySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("AT_PLACE"), placeId: id, territoryId: id }).strict(),
  z.object({ kind: z.literal("SERVICE_AREA"), purpose: z.enum(["TRAVEL", "DELIVERY"]),
    territoryIds: z.array(id).min(1) }).strict(),
  z.object({ kind: z.literal("UNKNOWN"), reason: z.enum(["NOT_PROVIDED", "LEGACY_INCOMPLETE"]) }).strict(),
]);

/** No amount is permitted for INCLUDED or ON_REQUEST. FROM is only a lower bound. */
const exactPrice = z.object({ kind: z.literal("EXACT"), amountByn: BynAmountSchema }).strict();
const fromPrice = z.object({ kind: z.literal("FROM"), minimumByn: BynAmountSchema }).strict();
const onRequestPrice = z.object({ kind: z.literal("ON_REQUEST") }).strict();
const unresolvedPriceReason = z.enum(["MISSING", "SOURCE_CONFLICT", "UNSUPPORTED_CURRENCY", "POLICY_PENDING"]);
export const PositionPriceSchema = z.discriminatedUnion("kind", [
  exactPrice, fromPrice, onRequestPrice,
  z.object({ kind: z.literal("INCLUDED"), parentItemId: id, packageComponentId: id }).strict(),
]);

/** Conflicting publication/operational prices stay unresolved until an owner-approved rule exists. */
export const OfferPriceEvidenceSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("RESOLVED"), source: SourceRefSchema.refine(v =>
    ["Offer", "OfferBooking", "PartyQuote"].includes(v.entity), "Offer price needs a price-owning source"),
    price: z.discriminatedUnion("kind", [exactPrice, fromPrice, onRequestPrice]) }).strict(),
  z.object({ state: z.literal("UNRESOLVED"), reason: unresolvedPriceReason,
    sources: z.array(SourceRefSchema) }).strict(),
]);

export const PackageComponentContractSchema = z.object({
  componentId: id, source: SourceRefSchema.refine(v => v.entity === "PackageComponent"),
  category: z.enum(PartyCategory), refOfferId: id.nullable(), title: id,
  // Existing isOptional is not silently reinterpreted as approved removability.
  legacyIsOptional: z.boolean(), removable: knownOrUnknown(z.boolean()),
  removalPriceRule: z.discriminatedUnion("state", [
    z.object({ state: z.literal("POLICY_PENDING") }).strict(),
    z.object({ state: z.literal("APPROVED"), ruleRef: id, revision: id }).strict(),
  ]),
}).strict().refine(v => v.componentId === v.source.id, "Source must identify this component");
export const PackageCompositionSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("COMPONENTS"), components: z.array(PackageComponentContractSchema).min(1) }).strict()
    .refine(v => new Set(v.components.map(c => c.componentId)).size === v.components.length,
      "Duplicate package component IDs"),
  z.object({ state: z.literal("LEGACY_CATEGORY_COVERAGE"), categories: z.array(z.enum(PartyCategory)),
    source: SourceRefSchema.refine(v => v.entity === "Offer") }).strict(),
  z.object({ state: z.literal("NOT_A_PACKAGE") }).strict(),
]);

export const AvailabilityEvidenceSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("AVAILABLE"), checkedAt: instant, requested: ServiceIntervalSchema,
    windows: z.array(ResourceWindowSchema).min(1) }).strict().refine(v => v.windows.every(w =>
      Date.parse(w.service.startAt) === Date.parse(v.requested.startAt) &&
      Date.parse(w.service.endAt) === Date.parse(v.requested.endAt)),
    "Available resource windows must cover the requested service interval"),
  z.object({ state: z.literal("PARTIAL"), checkedAt: instant, requested: ServiceIntervalSchema,
    alternatives: z.array(ServiceIntervalSchema).min(1) }).strict(),
  z.object({ state: z.literal("UNAVAILABLE"), checkedAt: instant, requested: ServiceIntervalSchema,
    reason: z.enum(["OCCUPIED", "CLOSED", "CAPACITY", "DURATION"]) }).strict(),
  z.object({ state: z.literal("UNKNOWN"), reason: z.enum([
    "NO_SCHEDULE", "NO_RESOURCE", "NO_EXACT_TIME", "CHECK_FAILED",
  ]) }).strict(),
]);

export const OfferForConstructorSchema = z.object({
  contractVersion: z.literal(BIRTHDAY_CONTRACT_VERSION), source: SourceRefSchema.refine(v => v.entity === "Offer"),
  offerId: id, businessId: id, productType: z.enum(["PARTY_SERVICE", "PARTY_PACKAGE"]),
  category: z.enum(PartyCategory).nullable(),
  // Additive A3 evidence; role is meaningful only inside the existing ANIMATOR category.
  performerRole: knownOrUnknown(z.enum(["ANIMATOR", "HOST"])).optional(),
  resources: z.array(z.object({
    source: SourceRefSchema.refine(v => v.entity === "BookingUnit"),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    capacity: knownOrUnknown(z.number().int().positive()),
    minimumDurationMinutes: knownOrUnknown(z.number().int().positive()),
    stepMinutes: knownOrUnknown(z.number().int().min(5).max(240)),
  }).strict()).optional(),
  location: z.object({ mode: knownOrUnknown(z.enum(PartyLocationType)),
    meaning: z.enum(["EVENT_LOCATION", "FULFILMENT"]) }).strict(),
  occasions: knownOrUnknown(z.array(z.enum(PartyOccasion))),
  age: AgeRestrictionSchema,
  participants: z.object({ children: participantLimits, totalCapacity: knownOrUnknown(count) }).strict(),
  interests: knownOrUnknown(interests), geography: z.array(ServiceGeographySchema).min(1),
  durationMinutes: knownOrUnknown(z.number().int().positive()),
  price: OfferPriceEvidenceSchema, composition: PackageCompositionSchema,
  availability: AvailabilityEvidenceSchema,
}).strict().superRefine((v, ctx) => {
  if (v.source.id !== v.offerId)
    ctx.addIssue({ code: "custom", path: ["source"], message: "Source must identify this offer" });
  if (v.productType === "PARTY_SERVICE" && v.category === null)
    ctx.addIssue({ code: "custom", path: ["category"], message: "Service category required" });
  if ((v.productType === "PARTY_SERVICE") !== (v.composition.state === "NOT_A_PACKAGE"))
    ctx.addIssue({ code: "custom", path: ["composition"], message: "Composition must match product type" });
});

/** An assessment is evidence, not permission to dispatch or confirm. No scoring weights here. */
export const ConstraintAssessmentSchema = z.object({
  dimension: z.enum(["PUBLICATION", "BUSINESS_ELIGIBILITY", "AGE", "PARTICIPANTS", "FORMAT",
    "GEOGRAPHY", "AVAILABILITY", "BUDGET", "INTERESTS", "MAMAGO_RATING"]),
  strength: z.enum(["HARD", "SOFT"]), outcome: z.enum(["MATCH", "MISMATCH", "UNKNOWN"]),
  reasonCode: id,
}).strict().refine(v =>
  ["BUDGET", "INTERESTS", "MAMAGO_RATING"].includes(v.dimension)
    ? v.strength === "SOFT" : v.strength === "HARD",
"Budget, interests and rating are soft; eligibility constraints are hard");

export const PartySelectionContextSchema = z.object({
  contractVersion: z.literal(BIRTHDAY_CONTRACT_VERSION), partyOrderId: id, partyVersion: count,
  entry: z.enum(PartyOrderEntry), venueMode: z.enum(PartyVenueMode),
  subjects: z.array(SubjectSchema.strict()),
  ageMonthsOnEventDate: knownOrUnknown(count),
  /** A3 preserves MONTH/legacy DOB uncertainty without exporting a birth date. */
  ageMonthsRangeOnEventDate: knownOrUnknown(z.object({ min: count, max: count }).strict().refine(v => v.min <= v.max)).optional(),
  interests: knownOrUnknown(ProfileInterestsConstraintSchema.shape.value),
  destination: knownOrUnknown(z.object({ territoryId: id, placeId: id.nullable() }).strict()),
  budget: knownOrUnknown(z.object({ minimumByn: BynAmountSchema.nullable(),
    maximumByn: BynAmountSchema.nullable() }).strict().refine(v =>
    (v.minimumByn !== null || v.maximumByn !== null) &&
    (v.minimumByn === null || v.maximumByn === null ||
      BigInt(v.minimumByn.replace(".", "")) <= BigInt(v.maximumByn.replace(".", ""))),
  "Known budget needs a bound and cannot be inverted")),
  dateRange: z.object({ from: z.iso.date(), to: z.iso.date() }).strict()
    .refine(v => v.from <= v.to, "Inverted date range"),
  interval: knownOrUnknown(ServiceIntervalSchema),
  guests: z.object({ children: count, adults: count }).strict(),
}).strict().refine(v => v.ageMonthsOnEventDate.state !== "KNOWN" || v.ageMonthsRangeOnEventDate?.state !== "KNOWN" ||
  (v.ageMonthsOnEventDate.value >= v.ageMonthsRangeOnEventDate.value.min && v.ageMonthsOnEventDate.value <= v.ageMonthsRangeOnEventDate.value.max), "Conflicting exact/range age evidence");

export const PartyProgramItemSchema = z.object({
  itemId: id, role: z.enum(PartyItemRole), offerId: id.nullable(),
  source: z.enum(["AUTO", "USER_ADDED", "USER_REPLACED"]), pinned: z.boolean(),
  lifecycle: z.enum(["ACTIVE", "REMOVED"]),
  interval: knownOrUnknown(ServiceIntervalSchema), dependsOnItemIds: z.array(id),
  assessments: z.array(ConstraintAssessmentSchema),
}).strict().refine(v => !v.dependsOnItemIds.includes(v.itemId), "Item cannot depend on itself");

export const EstimateLinePriceSchema = z.union([PositionPriceSchema,
  z.object({ kind: z.literal("UNRESOLVED"), reason: unresolvedPriceReason }).strict(),
]);
export const PreliminaryEstimateSchema = z.object({
  contractVersion: z.literal(BIRTHDAY_CONTRACT_VERSION), partyOrderId: id, partyVersion: count,
  calculatedAt: instant, currency: z.literal("BYN"),
  lines: z.array(z.object({ itemId: id, price: EstimateLinePriceSchema, sources: z.array(SourceRefSchema) }).strict()),
  knownMinimumByn: BynAmountSchema,
  // A preliminary estimate is never a final invoice, even when all current prices are exact.
  final: z.literal(false),
  unpricedItemIds: z.array(id), unconfirmedItemIds: z.array(id),
}).strict().superRefine((v, ctx) => {
  const ids = new Set(v.lines.map(l => l.itemId));
  const unknown = v.lines.filter(l => l.price.kind === "ON_REQUEST" || l.price.kind === "UNRESOLVED")
    .map(l => l.itemId).sort();
  if (ids.size !== v.lines.length || new Set(v.unpricedItemIds).size !== v.unpricedItemIds.length ||
    JSON.stringify(unknown) !== JSON.stringify([...v.unpricedItemIds].sort()) ||
    new Set(v.unconfirmedItemIds).size !== v.unconfirmedItemIds.length || v.unconfirmedItemIds.some(i => !ids.has(i)))
    ctx.addIssue({ code: "custom", message: "Estimate line IDs and unknown/unconfirmed sets must agree" });
  for (const line of v.lines) if (line.price.kind === "INCLUDED" &&
    (line.price.parentItemId === line.itemId || !ids.has(line.price.parentItemId)))
    ctx.addIssue({ code: "custom", message: "Included line must reference another estimate line" });
  const parents = new Map(v.lines.flatMap(l => l.price.kind === "INCLUDED" ? [[l.itemId, l.price.parentItemId]] : []));
  for (const itemId of parents.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = itemId;
    while (current !== undefined) {
      if (visited.has(current)) {
        ctx.addIssue({ code: "custom", message: "Cyclic included estimate lines" });
        break;
      }
      visited.add(current);
      current = parents.get(current);
    }
  }
});

/** Navigation only: no identity, session, signed file URL or booking command in this envelope. */
export const BusinessPartyRequestTargetSchema = z.object({
  contractVersion: z.literal(BIRTHDAY_CONTRACT_VERSION), destination: z.literal("PARTY_REQUEST"), requestId: id,
}).strict();

export type OfferForConstructor = z.infer<typeof OfferForConstructorSchema>;
export type ServiceInterval = z.infer<typeof ServiceIntervalSchema>;
export type ResourceWindow = z.infer<typeof ResourceWindowSchema>;
export type PackageComposition = z.infer<typeof PackageCompositionSchema>;
export type PositionPrice = z.infer<typeof PositionPriceSchema>;
export type AvailabilityEvidence = z.infer<typeof AvailabilityEvidenceSchema>;
export type PartySelectionContext = z.infer<typeof PartySelectionContextSchema>;
export type PartyProgramItem = z.infer<typeof PartyProgramItemSchema>;
export type PreliminaryEstimate = z.infer<typeof PreliminaryEstimateSchema>;
export type BusinessPartyRequestTarget = z.infer<typeof BusinessPartyRequestTargetSchema>;
