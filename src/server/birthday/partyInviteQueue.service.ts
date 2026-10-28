import "server-only";
import type { Prisma, PartyProviderDispatchMode } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";
import { verifyPartyOffers } from "./partyDraft.service";

type QueueCandidate = { offerId: string; businessId: string };

/**
 * Durable queue initialization ONLY. No BookingRequest, Telegram or PartyOutbox
 * writes occur here. A later dispatcher must atomically claim QUEUED rows.
 */
export async function queuePartyProviderCandidates(
  tx: Prisma.TransactionClient,
  params: {
    partyOrderItemId: string;
    mode: PartyProviderDispatchMode;
    candidates: QueueCandidate[];
  },
): Promise<{ queued: number; alreadyQueued: boolean }> {
  const { partyOrderItemId, mode, candidates } = params;
  if (mode !== "PARALLEL" && mode !== "SEQUENTIAL" ||
      candidates.length < 1 || candidates.length > 5 ||
      new Set(candidates.map(c => c.businessId)).size !== candidates.length ||
      new Set(candidates.map(c => c.offerId)).size !== candidates.length ||
      candidates.some(c => !c.offerId || !c.businessId)) {
    throw new PartyApiError(422, "Некорректная очередь исполнителей");
  }
  // Serialize competing queue initializations on the same canonical item.
  await tx.$queryRaw`SELECT "id" FROM "PartyOrderItem"
    WHERE "id" = ${partyOrderItemId} FOR UPDATE`;
  const item = await tx.partyOrderItem.findUnique({
    where: { id: partyOrderItemId },
    select: {
      role: true, status: true, category: true,
      partyOrder: { select: { citySlug: true, status: true } },
      requests: { select: { id: true }, take: 1 },
    },
  });
  if (!item || !["ADDON", "STANDALONE"].includes(item.role) ||
      item.partyOrder.status !== "ANCHOR_CONFIRMED") {
    throw new PartyApiError(409, "Дополнительная услуга ещё не готова к приглашениям");
  }
  const previous = await tx.partyProviderInvite.findMany({
    where: { partyOrderItemId },
    orderBy: { position: "asc" },
    select: { mode: true, offerId: true, businessId: true, position: true },
  });
  if (previous.length) {
    const identical = previous.length === candidates.length && previous.every((row, index) =>
      row.mode === mode && row.position === index &&
      row.offerId === candidates[index].offerId &&
      row.businessId === candidates[index].businessId);
    if (!identical) throw new PartyApiError(409, "Очередь исполнителей уже изменилась");
    return { queued: 0, alreadyQueued: true };
  }
  if (item.status !== "PLANNED" || item.requests.length)
    throw new PartyApiError(409, "По дополнительной услуге уже отправлены заявки");

  // Re-validate all candidates against the public offer pool at write time.
  const published = await verifyPartyOffers(
    item.partyOrder.citySlug, candidates.map(c => c.offerId), tx,
  );
  if (candidates.some(candidate => {
    const offer = published.get(candidate.offerId);
    return !offer || offer.productType !== "PARTY_SERVICE" ||
      offer.category !== item.category ||
      offer.place?.ownerBusinessId !== candidate.businessId;
  })) throw new PartyApiError(422, "Один из исполнителей больше не доступен");

  await tx.partyProviderInvite.createMany({
    data: candidates.map((candidate, position) => ({
      partyOrderItemId, businessId: candidate.businessId,
      offerId: candidate.offerId, position, mode, status: "QUEUED",
    })),
  });
  return { queued: candidates.length, alreadyQueued: false };
}
