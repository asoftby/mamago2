import { minskBookingWindow } from "./partyConfirmationAvailability";
import { buildSelectedProfileContext } from "@/lib/decision/subjects";
import { PartySelectionContextSchema } from "@/lib/birthday/constructorContract";
import "server-only";
import { PartyCategory } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError } from "./partyDraft.validation";
import { findAvailablePartyCandidates } from "./partyAvailableCandidates";

/**
 * Read-only matching scoped to an authenticated parent's existing party.
 * Never dispatches a request or changes the booking workflow.
 */
export async function findCandidatesForParty(
  ownerUserId: string,
  partyId: string,
  category: PartyCategory,
  additionalExcludedBusinessIds: readonly string[] = [],
  selection: { personaIds?: string[]; performerRole?: "HOST" | "ANIMATOR"; audience?: "ADULT" | "CHILD" } = {},
) {
  const party = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    select: {
      id: true, entry: true, venueMode: true, version: true, citySlug: true, eventDate: true, timeFrom: true, timeTo: true,
      childrenCount: true, adultsCount: true, childAge: true, budgetByn: true,
      items: { select: { businessId: true, category: true, role: true } },
    },
  });
  if (!party) throw new PartyApiError(404, "Праздник не найден");
  if (!party.eventDate || !party.timeFrom || !party.timeTo ||
      party.childrenCount === null || party.adultsCount === null)
    throw new PartyApiError(422, "Укажите дату, время и количество гостей");

  // Exclude the already-selected businesses; never recommend the same company twice.
  const excludedBusinessIds = [...new Set([...additionalExcludedBusinessIds, ...party.items
    .map(item => item.businessId)
    .filter((id): id is string => Boolean(id))])];
  const profile = await buildSelectedProfileContext({ userId: ownerUserId, personaIds: selection.personaIds ?? [], targetDate: party.eventDate.toISOString().slice(0,10), includeAgeEvidence: true });
  const subjects = profile.subjects.length ? profile.subjects : selection.audience ? [{ kind: selection.audience === "ADULT" ? "adult" as const : "child" as const, refId: null, source: "manual" as const }] : party.childAge !== null ? [{ kind: party.childAge >= 18 ? "adult" as const : "child" as const, refId: null, source: "manual" as const }] : [];
  const window = minskBookingWindow(party.eventDate,party.timeFrom,party.timeTo,0,0);
  const startAt = window.serviceStart.toISOString(), endAt = window.serviceEnd.toISOString();
  const unknown = { state: "UNKNOWN" as const, reason: "NOT_PROVIDED" as const };
  const selectionContext = PartySelectionContextSchema.parse({
    contractVersion: 1, partyOrderId: party.id, partyVersion: party.version, entry: party.entry, venueMode: party.venueMode,
    subjects, ageMonthsOnEventDate: profile.ageMonthsInterval && profile.ageMonthsInterval.min === profile.ageMonthsInterval.max ? { state: "KNOWN", value: profile.ageMonthsInterval.min } : unknown,
    ageMonthsRangeOnEventDate: profile.ageMonthsInterval ? { state: "KNOWN", value: profile.ageMonthsInterval } : unknown,
    interests: profile.subjects.length ? { state: "KNOWN", value: profile.systemInterestSlugs } : unknown,
    destination: unknown, budget: party.budgetByn === null ? unknown : { state: "KNOWN", value: { minimumByn: null, maximumByn: party.budgetByn.toFixed(2) } },
    dateRange: { from: party.eventDate.toISOString().slice(0,10), to: party.eventDate.toISOString().slice(0,10) },
    interval: { state: "KNOWN", value: { startAt, endAt } }, guests: { children: party.childrenCount, adults: party.adultsCount },
  });
  const candidates = await findAvailablePartyCandidates({
    citySlug: party.citySlug,
    legacyAgeRangeMonths: !selection.audience && !profile.subjects.length && party.childAge !== null ? { min: party.childAge * 12, max: party.childAge * 12+11 } : undefined,
    category, performerRole: selection.performerRole, selectionContext, venueMode: party.venueMode,
    date: party.eventDate.toISOString().slice(0, 10),
    timeFrom: party.timeFrom,
    timeTo: party.timeTo,
    childrenCount: party.childrenCount,
    adultsCount: party.adultsCount,
    childAge: party.childAge,
    budgetByn: party.budgetByn === null ? null : Number(party.budgetByn),
    excludedBusinessIds,
  });
  return { partyId: party.id, partyVersion: party.version, category, candidates, finalConfirmationRequired: true };
}
