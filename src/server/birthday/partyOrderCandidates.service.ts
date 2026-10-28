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
) {
  const party = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    select: {
      id: true, version: true, citySlug: true, eventDate: true, timeFrom: true, timeTo: true,
      childrenCount: true, adultsCount: true, childAge: true, budgetByn: true,
      items: { select: { businessId: true, category: true, role: true } },
    },
  });
  if (!party) throw new PartyApiError(404, "Праздник не найден");
  if (!party.eventDate || !party.timeFrom || !party.timeTo ||
      party.childrenCount === null || party.adultsCount === null)
    throw new PartyApiError(422, "Укажите дату, время и количество гостей");

  // Exclude the already-selected businesses; never recommend the same company twice.
  const excludedBusinessIds = [...new Set(party.items
    .map(item => item.businessId)
    .filter((id): id is string => Boolean(id)))];
  const candidates = await findAvailablePartyCandidates({
    citySlug: party.citySlug,
    category,
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
