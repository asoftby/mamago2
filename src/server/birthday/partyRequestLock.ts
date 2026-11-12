import type { Prisma } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";

/**
 * A confirmed provider closes sibling requests for the same item. Lock that
 * small indexed group in a stable order before resources/item/order, so a
 * sibling quote decision cannot hold a request that confirmation later needs.
 * The transaction-scoped item mutex also covers siblings created during this
 * decision. Two bounded DB round trips; unrelated items remain independent.
 */
export async function lockPartyRequestGroup(tx: Prisma.TransactionClient, requestId: string): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(
      'party-request:' || COALESCE("partyOrderItemId", "id"), 0
    ))::text AS locked FROM "BookingRequest" WHERE "id" = ${requestId}
  `;
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT r."id" FROM "BookingRequest" r
    WHERE r."id" = ${requestId} OR r."partyOrderItemId" = (
      SELECT "partyOrderItemId" FROM "BookingRequest" WHERE "id" = ${requestId}
    )
    ORDER BY r."id" FOR UPDATE
  `;
  if (!locked.some(row => row.id === requestId)) throw new PartyApiError(404, "Заявка не найдена");
}
