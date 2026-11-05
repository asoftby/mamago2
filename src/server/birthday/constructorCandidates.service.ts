import { getAgeRangeMonths } from "@/lib/config/ages";
import "server-only";
import { type PartyCategory, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { OfferForConstructorSchema, type PartySelectionContext, type ServiceInterval } from "@/lib/birthday/constructorContract";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { isEligibleForConstructor } from "./constructorEligibility";
import { constructorOfferSelect, toConstructorOffer } from "./constructorOffer";
import { assessConstructorOffer, rankConstructorOffers, type AssessedConstructorOffer, type ConstructorRequirements } from "./constructorMatching";
import { loadPartyAvailability } from "./partyAvailabilityPreview.service";
import { minskBookingWindow } from "./partyConfirmationAvailability";

export type ConstructorCandidateQuery = {
  citySlug: string; category?: PartyCategory; productType?: "PARTY_SERVICE" | "PARTY_PACKAGE";
  venueMode?: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  childrenCount: number; adultsCount?: number; childAge: number | null; budgetByn: number | null;
  date?: string; timeFrom?: string; timeTo?: string;
  excludedBusinessIds?: readonly string[]; performerRole?: "HOST" | "ANIMATOR";
  /** Trusted server context, never an unchecked request body or profile snapshot. */
  selectionContext?: PartySelectionContext;
  /** Bound retained memory after full-page evaluation, never truncate DB candidates before checks. */
  resultLimit?: number;
  /** Explicit legacy order evidence, passed only when no replacement recipient was selected. */
  legacyAgeRangeMonths?: { min: number; max: number };
  preferredOfferId?: string | null;
};
const unknown = { state: "UNKNOWN" as const, reason: "NOT_PROVIDED" as const };

export function candidateRequirements(input: ConstructorCandidateQuery, destination: ConstructorRequirements["destination"]): ConstructorRequirements {
  const context = input.selectionContext;
  const profileChild = context?.subjects.length === 1 && context.subjects[0].kind === "child" ? context.subjects[0] : null;
  const range = profileChild?.ageRange ? getAgeRangeMonths(profileChild.ageRange) : null;
  const precise = context?.ageMonthsRangeOnEventDate;
  const ageRangeMonths = precise?.state === "KNOWN" ? precise.value : range ? { min: range.minMonths, max: range.maxMonths ?? Number.MAX_SAFE_INTEGER } : context ? input.legacyAgeRangeMonths : input.childAge !== null ? { min: input.childAge * 12, max: input.childAge * 12 + 11 } : undefined;
  return {
    category: input.category, performerRole: input.performerRole,
    venueMode: context?.venueMode ?? input.venueMode ?? "VENUE",
    subjects: context?.subjects ?? (input.childAge === null ? [] : [{ kind: input.childAge >= 18 ? "adult" : "child", refId: null, source: "manual" }]),
    ageMonthsOnEventDate: context?.ageMonthsOnEventDate ?? unknown,
    ageRangeMonths, interests: context?.interests ?? unknown,
    destination: context?.destination.state === "KNOWN" ? context.destination : destination,
    guests: context?.guests ?? { children: input.childrenCount, adults: input.adultsCount ?? 0 },
    budget: context?.budget ?? (input.budgetByn === null ? unknown : { state: "KNOWN", value: { minimumByn: null, maximumByn: input.budgetByn.toFixed(2) } }),
  };
}
export function candidateInterval(input: ConstructorCandidateQuery): ServiceInterval | null {
  if (input.selectionContext) return input.selectionContext.interval.state === "KNOWN" ? input.selectionContext.interval.value : null;
  if (!input.date || !input.timeFrom || !input.timeTo) return null;
  const date = new Date(input.date + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== input.date) return null;
  const w = minskBookingWindow(date,input.timeFrom,input.timeTo,0,0);
  return { startAt: w.serviceStart.toISOString(), endAt: w.serviceEnd.toISOString() };
}

/** One read-only candidate path shared by ranking/discovery/availability. No assembly, dispatch or Boost. */
export async function loadConstructorCandidates(input: ConstructorCandidateQuery, db: Prisma.TransactionClient = prisma, now = new Date()): Promise<AssessedConstructorOffer[]> {
  if (!Number.isInteger(input.childrenCount) || input.childrenCount < 0 || input.childrenCount > 500 ||
      !Number.isInteger(input.adultsCount ?? 0) || (input.adultsCount ?? 0) < 0 || input.childrenCount + (input.adultsCount ?? 0) > 1000 ||
      input.childAge !== null && (!Number.isInteger(input.childAge) || input.childAge < 0) ||
      input.budgetByn !== null && (!Number.isFinite(input.budgetByn) || input.budgetByn < 0)) return [];
  const city = await findCityBySlug(input.citySlug,{ db, select: { id: true }, isActive: true });
  if (!city) return [];
  const legacy = await db.territoryLegacyMap.findUnique({ where: { legacyKind_legacyId: { legacyKind: "CITY", legacyId: city.id } }, select: { territoryId: true } });
  const requirements = candidateRequirements(input, legacy ? { state: "KNOWN", value: { territoryId: legacy.territoryId, placeId: null } } : unknown);
  let interval: ServiceInterval | null;
  try { interval = candidateInterval(input); } catch { return []; }
  const excluded = new Set(input.excludedBusinessIds ?? []);
  let candidates: AssessedConstructorOffer[] = [];
  const limit = Math.min(500,Math.max(1,input.resultLimit ?? 500));
  let cursor: string | undefined;
  while (true) {
    const rows = await db.offer.findMany({
      // Geography is assessed from service evidence below, never from registration city.
      where: { AND: [getPublicBirthdayOfferWhere(null),
        ...(input.category ? [{ category: input.category, productType: "PARTY_SERVICE" as const }] : []),
        ...(input.productType ? [{ productType: input.productType }] : []),
      ] },
      select: constructorOfferSelect, orderBy: { id: "asc" }, take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    const admitted = rows.filter(row => row.place?.ownerBusinessId && !excluded.has(row.place.ownerBusinessId) && isEligibleForConstructor(row.place.ownerBusiness)).flatMap(row => {
      try { const offer = toConstructorOffer(row); return assessConstructorOffer(offer,requirements).eligible ? [{ row, offer }] : []; }
      catch { return []; }
    });
    const evidence = await loadPartyAvailability(db, admitted.map(({row}) => ({ id: row.id, businessId: row.place!.ownerBusinessId! })), interval, requirements.guests.children + requirements.guests.adults, now);
    for (const { row, offer } of admitted) {
      offer.availability = evidence.get(row.id)?.availability ?? { state: "UNKNOWN", reason: "CHECK_FAILED" };
      const units = evidence.get(row.id)?.units ?? [];
      offer.resources = units.map(unit => ({ source: { entity: "BookingUnit", id: unit.id, revision: unit.updatedAt.toISOString() }, status: unit.status,
        capacity: unit.capacity !== null && unit.capacity > 0 ? { state: "KNOWN", value: unit.capacity } : unknown,
        minimumDurationMinutes: unit.minDurationMinutes !== null && unit.minDurationMinutes > 0 ? { state: "KNOWN", value: unit.minDurationMinutes } : unknown,
        stepMinutes: unit.stepMinutes >= 5 && unit.stepMinutes <= 240 ? { state: "KNOWN", value: unit.stepMinutes } : unknown,
      }));
      OfferForConstructorSchema.parse(offer);
      const assessment = assessConstructorOffer(offer,requirements);
      assessment.assessments.unshift({ dimension: "PUBLICATION", strength: "HARD", outcome: "MATCH", reasonCode: "PUBLISHED_BIRTHDAY_PLACEMENT" }, { dimension: "BUSINESS_ELIGIBILITY", strength: "HARD", outcome: "MATCH", reasonCode: "ACTIVE_APPROVED_POSITIVE_DEPOSIT" });
      if (assessment.eligible) candidates.push({ offer, ...assessment });
    }
    const ranked = rankConstructorOffers(candidates);
    if (input.preferredOfferId) ranked.sort((a,b) => Number(b.offer.offerId === input.preferredOfferId) - Number(a.offer.offerId === input.preferredOfferId));
    const seen = new Set<string>();
    candidates = ranked.filter(c => { if (seen.has(c.offer.businessId)) return false; seen.add(c.offer.businessId);return true; }).slice(0,limit);
    cursor = rows[rows.length-1].id;
    if (rows.length < 200) break;
  }
  return rankConstructorOffers(candidates);
}
