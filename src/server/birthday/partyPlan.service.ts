import { Prisma } from "@prisma/client";
import { minskBookingWindow } from "./partyConfirmationAvailability";
import { partyOrderReadModel } from "./partyOrderReadModel";

/** Call within the transaction that owns the PartyOrder transition. */
export async function createPartyPlan(tx: Prisma.TransactionClient, party: {
  id: string; ownerUserId: string; selectedChildId: string | null;
  eventDate: Date; timeFrom: string; timeTo: string;
}, familyId: string) {
  const window = minskBookingWindow(party.eventDate, party.timeFrom, party.timeTo, 0, 0);
  const plan = await tx.planItem.create({
    data: {
      userId: party.ownerUserId, familyId, visibility: "PRIVATE", source: "MANUAL", entryType: "EVENT",
      date: party.eventDate.toISOString().slice(0, 10), startsAt: window.serviceStart, endsAt: window.serviceEnd,
      childId: party.selectedChildId, title: "День рождения", notes: "Ожидаем подтверждения",
    },
    select: { id: true },
  });
  await tx.partyOrder.update({ where: { id: party.id }, data: { planItemId: plan.id, familyId } });
  return plan.id;
}

export async function syncPartyPlan(tx: Prisma.TransactionClient, partyId: string) {
  const party = await tx.partyOrder.findUnique({
    where: { id: partyId },
    select: {
      planItemId: true, ownerUserId: true, status: true, cancelledAt: true,
      items: { select: {
        role: true, status: true, offerPriceSnapshot: true, confirmedBookingRequestId: true,
        requests: { select: { id: true, partyStage: true, partyQuotes: { select: { status: true, priceByn: true, validUntil: true } } } },
      } },
    },
  });
  if (!party?.planItemId) return;
  const summary = partyOrderReadModel(party);
  const notes = summary.stage === "CANCELLED" ? "Праздник отменён"
    : summary.stage === "READY" ? "Праздник подготовлен"
    : summary.stage === "PARTIAL" || summary.stage === "ANCHOR_CONFIRMED" ? "Основная услуга подтверждена"
    : summary.stage === "UNAVAILABLE" ? "Нужно выбрать другой вариант" : "Ожидаем подтверждения";
  await tx.planItem.updateMany({
    where: { id: party.planItemId, userId: party.ownerUserId },
    data: {
      notes, priceAmount: summary.confirmedAmountByn === null || summary.awaitingCount > 0 || summary.confirmedPriceUnknownCount > 0 || new Prisma.Decimal(summary.confirmedAmountByn).greaterThan("99999999.99")
        ? null : new Prisma.Decimal(summary.confirmedAmountByn),
      ...(party.status === "CANCELLED" ? { status: "CANCELLED", cancelledAt: party.cancelledAt } : {}),
    },
  });
}
